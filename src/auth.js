/**
 * Two Girls Brew - 用户认证系统
 * 支持手机号/邮箱注册，三种角色：CEO/技术管理员/门店店长
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// 角色定义
const ROLES = {
  ceo: {
    id: 'ceo',
    name: '老板CEO',
    icon: '👑',
    color: '#FFD700',
    permissions: ['*'], // 全部权限
    description: '公司最高管理者，拥有全部系统权限'
  },
  admin: {
    id: 'admin',
    name: '技术管理员',
    icon: '⚙️',
    color: '#2196F3',
    permissions: [
      'dashboard:view', 'agents:view', 'agents:edit', 'agents:delete',
      'chat:view', 'chat:send',
      'mcp:view', 'skills:view', 'cron:view', 'cron:edit',
      'channels:view', 'channels:edit',
      'resources:view', 'resources:edit', 'resources:delete',
      'settings:view', 'settings:edit',
      'providers:view', 'providers:edit',
      'prompts:view', 'prompts:edit',
      'reports:view', 'reports:generate',
      'users:view'
    ],
    description: '系统技术管理员，负责系统配置和维护'
  },
  manager: {
    id: 'manager',
    name: '门店店长',
    icon: '🏪',
    color: '#4CAF50',
    permissions: [
      'dashboard:view',
      'agents:view',
      'chat:view', 'chat:send',
      'resources:view',
      'reports:view', 'reports:generate',
      'settings:view'
    ],
    description: '门店运营管理者，查看门店数据和报表'
  }
};

// 用户数据存储路径 - 打包后使用用户目录，开发环境使用项目目录
function getDataDir() {
  // 优先使用环境变量
  if (process.env.DATA_PATH) return process.env.DATA_PATH;
  // 检查是否在 asar 打包环境中
  if (__dirname.includes('app.asar')) {
    // 打包后：使用用户数据目录
    const os = require('os');
    const dataDir = path.join(os.homedir(), '.two-girls-brew');
    return dataDir;
  }
  // 开发环境：使用项目目录
  return path.join(__dirname, '..', 'data');
}

const DATA_DIR = getDataDir();
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

// 内存存储
let users = [];
let sessions = {};

// 确保数据目录存在
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// 加载用户数据
function loadUsers() {
  ensureDataDir();
  try {
    if (fs.existsSync(USERS_FILE)) {
      users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
    }
  } catch (e) {
    users = [];
  }
}

// 保存用户数据
function saveUsers() {
  ensureDataDir();
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
}

// 加载会话数据
function loadSessions() {
  ensureDataDir();
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      sessions = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf-8'));
    }
  } catch (e) {
    sessions = {};
  }
}

// 保存会话数据
function saveSessions() {
  ensureDataDir();
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2), 'utf-8');
}

// 密码哈希
function hashPassword(password) {
  return crypto.createHash('sha256').update(password + 'two-girls-brew-salt').digest('hex');
}

// 生成 token
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// 验证手机号格式
function isValidPhone(phone) {
  return /^1[3-9]\d{9}$/.test(phone);
}

// 验证邮箱格式
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// 生成用户ID
function generateUserId(role) {
  const prefix = { ceo: 'CEO', admin: 'ADM', manager: 'MGR' };
  const timestamp = Date.now().toString(36).toUpperCase();
  return `${prefix[role] || 'USR'}${timestamp}`;
}

// 初始化默认用户（首次使用时创建）
function initDefaultUsers() {
  if (users.length === 0) {
    const defaultUsers = [
      {
        id: 'CEO' + Date.now().toString(36).toUpperCase(),
        name: '黄总',
        phone: '13800000001',
        email: 'ceo@twogirlsbrew.com',
        password: hashPassword('admin123'),
        role: 'ceo',
        avatar: '👑',
        createdAt: Date.now(),
        lastLogin: null,
        status: 'active'
      },
      {
        id: 'ADM' + Date.now().toString(36).toUpperCase(),
        name: 'TIM',
        phone: '13800000002',
        email: 'tim@twogirlsbrew.com',
        password: hashPassword('admin123'),
        role: 'admin',
        avatar: '⚙️',
        createdAt: Date.now(),
        lastLogin: null,
        status: 'active'
      },
      {
        id: 'MGR' + Date.now().toString(36).toUpperCase(),
        name: '店长小明',
        phone: '13800000003',
        email: 'manager@twogirlsbrew.com',
        password: hashPassword('admin123'),
        role: 'manager',
        avatar: '🏪',
        createdAt: Date.now(),
        lastLogin: null,
        status: 'active'
      }
    ];
    users = defaultUsers;
    saveUsers();
    console.log('[Auth] 默认用户已创建');
    console.log('  老板CEO: 13800000001 / admin123');
    console.log('  技术管理员TIM: 13800000002 / admin123');
    console.log('  门店店长: 13800000003 / admin123');
  }
}

// ========== API 方法 ==========

/**
 * 用户注册
 * @param {Object} params - { name, phone?, email?, password, role }
 */
function register(params) {
  const { name, phone, email, password, role } = params;

  // 验证
  if (!name || !name.trim()) {
    return { success: false, error: '请输入姓名' };
  }
  if (!password || password.length < 6) {
    return { success: false, error: '密码至少6位' };
  }
  if (!phone && !email) {
    return { success: false, error: '请输入手机号或邮箱' };
  }
  if (phone && !isValidPhone(phone)) {
    return { success: false, error: '手机号格式不正确' };
  }
  if (email && !isValidEmail(email)) {
    return { success: false, error: '邮箱格式不正确' };
  }
  if (!ROLES[role]) {
    return { success: false, error: '无效的角色类型' };
  }

  // 检查是否已注册
  if (phone && users.find(u => u.phone === phone)) {
    return { success: false, error: '该手机号已注册' };
  }
  if (email && users.find(u => u.email === email)) {
    return { success: false, error: '该邮箱已注册' };
  }

  const newUser = {
    id: generateUserId(role),
    name: name.trim(),
    phone: phone || '',
    email: email || '',
    password: hashPassword(password),
    role,
    avatar: ROLES[role].icon,
    createdAt: Date.now(),
    lastLogin: null,
    status: 'active'
  };

  users.push(newUser);
  saveUsers();

  return {
    success: true,
    data: {
      id: newUser.id,
      name: newUser.name,
      role: newUser.role,
      roleName: ROLES[role].name,
      avatar: newUser.avatar
    }
  };
}

/**
 * 用户登录（支持手机号或邮箱）
 * @param {Object} params - { account (手机号或邮箱), password }
 */
function login(params) {
  const { account, password } = params;

  if (!account) {
    return { success: false, error: '请输入手机号或邮箱' };
  }
  if (!password) {
    return { success: false, error: '请输入密码' };
  }

  // 查找用户（支持手机号或邮箱登录）
  const user = users.find(u =>
    (u.phone === account || u.email === account) && u.status === 'active'
  );

  if (!user) {
    return { success: false, error: '账号不存在或已禁用' };
  }

  if (user.password !== hashPassword(password)) {
    return { success: false, error: '密码错误' };
  }

  // 更新最后登录时间
  user.lastLogin = Date.now();
  saveUsers();

  // 生成 token
  const token = generateToken();
  sessions[token] = {
    userId: user.id,
    role: user.role,
    createdAt: Date.now(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24小时
  };
  saveSessions();

  return {
    success: true,
    data: {
      token,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        roleName: ROLES[user.role].name,
        avatar: user.avatar,
        permissions: ROLES[user.role].permissions
      }
    }
  };
}

/**
 * 验证 token
 */
function verifyToken(token) {
  if (!token || !sessions[token]) {
    return null;
  }

  const session = sessions[token];

  // 检查过期
  if (Date.now() > session.expiresAt) {
    delete sessions[token];
    saveSessions();
    return null;
  }

  // 延长会话
  session.expiresAt = Date.now() + 24 * 60 * 60 * 1000;
  saveSessions();

  const user = users.find(u => u.id === session.userId);
  if (!user || user.status !== 'active') {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    role: user.role,
    roleName: ROLES[user.role].name,
    avatar: user.avatar,
    permissions: ROLES[user.role].permissions
  };
}

/**
 * 退出登录
 */
function logout(token) {
  if (token && sessions[token]) {
    delete sessions[token];
    saveSessions();
  }
  return { success: true };
}

/**
 * 获取所有用户列表（管理员功能）
 */
function getUsers(token) {
  const currentUser = verifyToken(token);
  if (!currentUser || (currentUser.role !== 'ceo' && currentUser.role !== 'admin')) {
    return { success: false, error: '无权限' };
  }

  return {
    success: true,
    data: users.map(u => ({
      id: u.id,
      name: u.name,
      phone: u.phone,
      email: u.email,
      role: u.role,
      roleName: ROLES[u.role].name,
      avatar: u.avatar,
      status: u.status,
      createdAt: u.createdAt,
      lastLogin: u.lastLogin
    }))
  };
}

/**
 * 获取当前用户信息
 */
function getCurrentUser(token) {
  const user = verifyToken(token);
  if (!user) {
    return { success: false, error: '未登录或登录已过期' };
  }
  return { success: true, data: user };
}

/**
 * 获取所有角色定义
 */
function getRoles() {
  return {
    success: true,
    data: Object.values(ROLES).map(r => ({
      id: r.id,
      name: r.name,
      icon: r.icon,
      color: r.color,
      description: r.description
    }))
  };
}

/**
 * 检查权限
 */
function checkPermission(token, permission) {
  const user = verifyToken(token);
  if (!user) return false;
  if (user.permissions.includes('*')) return true;
  return user.permissions.includes(permission);
}

// 初始化
loadUsers();
loadSessions();
initDefaultUsers();

module.exports = {
  ROLES,
  register,
  login,
  logout,
  verifyToken,
  getUsers,
  getCurrentUser,
  getRoles,
  checkPermission
};
