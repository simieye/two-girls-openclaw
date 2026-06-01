/**
 * Two Girls Brew 后台管理服务器
 * 提供 REST API + WebSocket + 静态页面
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { getAllAgentsData, getAgentList, AI_PROVIDERS, CHANNELS, MCP_CONNECTORS, SKILLS, CRON_JOBS, getAgentLayerData, LAYERS } = require('./agents/layers/index');
const auth = require('./auth');

const PORT = process.env.PORT || 3456;
const PUBLIC_PATH = process.env.PUBLIC_PATH || path.join(__dirname, '..', 'public');

// MIME types
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// 内存中的AI提供商数据 (支持运行时修改)
let providers = JSON.parse(JSON.stringify(AI_PROVIDERS));

// 内存中的AI搭档prompt设置 (6层)
// 结构: { agentId: { identity: '...', memory: '...', soul: '...', user: '...', agent: '...', tools: '...' } }
let agentPrompts = {};

// 内存中的频道设置
let channelSettings = JSON.parse(JSON.stringify(CHANNELS));

// ========== 持久化数据系统 ==========
const { getDataDir } = require('./auth');

function getCustomDataDir() {
  try {
    return getDataDir();
  } catch (e) {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '/tmp';
    const dataDir = path.join(homeDir, '.two-girls-brew');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    return dataDir;
  }
}

function loadCustomData(filename, defaultValue) {
  try {
    const filePath = path.join(getCustomDataDir(), filename);
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (e) {}
  return JSON.parse(JSON.stringify(defaultValue));
}

function saveCustomData(filename, data) {
  try {
    const filePath = path.join(getCustomDataDir(), filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (e) {
    return false;
  }
}

// 内存中的自定义MCP连接器（带持久化）
let customMcpConnectors = loadCustomData('mcp_connectors.json', []);
// 内存中的自定义Skills（带持久化）
let customSkills = loadCustomData('custom_skills.json', []);
// 内存中的自定义定时任务（带持久化）
let customCronJobs = loadCustomData('custom_cron_jobs.json', []);
// 内存中的自定义AI搭档（带持久化）
let customAgents = loadCustomData('custom_agents.json', []);
// agentId counter
let agentIdCounter = customAgents.length > 0 ? Math.max(...customAgents.map(a => parseInt(a._counter || 0))) + 1 : 1;

// ========== 活动发布模块 ==========
const QRCode = require('qrcode');

// 活动类型定义
const EVENT_TYPES = [
  { id: 'beer_festival', name: '啤酒节活动', icon: '🍺', color: '#FFD700', desc: '精酿啤酒品鉴、新品首发、门店联动' },
  { id: 'music_festival', name: '音乐节活动', icon: '🎵', color: '#E91E63', desc: '现场音乐、品牌联名、氛围营销' },
  { id: 'pop_up', name: '快闪活动', icon: '⚡', color: '#9C27B0', desc: '限时快闪、打卡引流、社交裂变' }
];

// 活动状态定义
const EVENT_STATUSES = {
  draft: { label: '草稿', color: '#666' },
  published: { label: '已发布', color: '#4CAF50' },
  ongoing: { label: '进行中', color: '#2196F3' },
  ended: { label: '已结束', color: '#999' }
};

// 预置活动模板（含绿皮火车首发等真实数据）
const EVENT_TEMPLATES = [
  {
    id: 'tpl_green_train',
    type: 'beer_festival',
    title: '绿皮火车西海岸IPA首发',
    subtitle: '儿童节快乐！TWO GIRLS绿皮火车已出发，下一站到哪？',
    coverImage: '',
    startDate: '2026-06-01',
    endDate: '2026-06-30',
    location: '全部门店',
    description: `绿皮摇晃 酒花绽放

站台渐远 麦香渐浓
铁轨锈迹酿出黄金液体 哐当声里摇晃出绵密酒沫
车窗略过的每一帧风景，都在酒沫里慢速放映

也许，笨重的火车需要花费愚蠢的奔跑才能来到你的站台。
我们来了，希望你也在等待。

TWO GIRLS 绿皮火车西海岸IPA期待您的打卡`,
    benefits: [
      { title: '定制 TWO GIRLS品牌T恤*1', icon: '👕' },
      { title: '定制 TWO GIRLS 品牌美式品脱杯*1', icon: '🍺' },
      { title: '门店定制推广策划——打卡活动', icon: '📸' },
      { title: '隐藏福利：铁路公园店开业暨上街店2周年庆店铺畅饮券1张', icon: '🎫' }
    ],
    stores: {
      福州: ['TWO GIRLS精酿啤酒&CBBQ(闽侯上街店)', 'TWO GIRLS精酿啤酒&CBBQ烧烤(三盛i33店)', '山石酒馆 兔子洞万宝店', '山石酒馆 稻田岩烧店', '山石酒馆 中式炭火烧烤五四路店', 'M-CORNER遇转角·美式餐吧', '山海旅人', '胡子精酿H.zi Tap Room', '酒漾精酿啤酒馆', '土狗精酿', '斑马酒馆', '东西精酿', '熏+12HOURS(A·ONE运动公园店)', '熏+12HOURS(融侨里店)', '上头时刻精酿酒馆', '9厝·BAR', 'LA精酿博物馆', 'lofi精酿&咖啡', 'LOOK精酿'],
      莆田: ['云雀西餐厅'],
      龙岩: ['竹修Tap Room'],
      宁德: ['城北精酿', '小里的房子'],
      厦门: ['TWO GIRLS精酿啤酒&艾尔拉格', '瓦伦sm店', '野菌培养室', '九十新疆酒食', '丹尼大叔军梦双拥店', '叹食TIMES·Y融合精酿餐吧', '永Forever酒吧', '甲板DECK', 'PokerGo bar', '巷仔精酿', '大饮好市', '0985精酿', '二狗精酿软件园店', '反派FunPal·融合餐酒馆', '灰熊精酿', '沫须有MORE SEE YOU', 'RTS开熏', '99ZOOM众', '打铁精酿', '非水酒屋NON-WATER TAPROOM', '请裁酒家'],
      泉州: ['山海精酿', '酒酿时光', 'LIT精酿', '中性牛奶旅店'],
      漳州: ['菜鸟', 'HOOK beer shop', '府呈食酒馆', '单向道精酿咖啡', '地气小酒馆', '阿卜杜拉·uptolove精酿酒馆', '44·TapRoom']
    },
    tags: ['首发福利', '打卡赠饮', '绿皮火车', '西海岸IPA', '儿童节'],
    isTemplate: true,
    createdAt: '2026-06-01T00:00:00Z'
  },
  {
    id: 'tpl_xiamen_beerfest',
    type: 'beer_festival',
    title: '2026厦门首届精酿啤酒节',
    subtitle: '奔赴夏日星际 邂逅微醺奇遇',
    coverImage: '',
    startDate: '2026-05-29',
    endDate: '2026-05-31',
    location: '厦门·磐基中心东北门广场',
    description: `五月风柔，初夏正好。爵对好势: 2026厦门首届精酿啤酒节即将开启，诚邀您一起登陆鹭岛星球开启漫游之旅。让我们共同乘坐爵士晚风，在烟火里尽情摇摆，解锁别样城市乐趣！`,
    benefits: [
      { title: '暖场 / 主持人开场', icon: '🎤' },
      { title: '主办方致辞 / 嘉宾致辞', icon: '🗣️' },
      { title: '厂牌巡礼', icon: '🍺' },
      { title: '开桶仪式 / 祝酒启幕', icon: '🥂' }
    ],
    schedule: [
      { time: '15:30-15:35', item: '暖场 / 主持人开场' },
      { time: '15:35-15:40', item: '主办方致辞 / 嘉宾致辞' },
      { time: '15:40-15:45', item: '厂牌巡礼' },
      { time: '15:45-15:50', item: '开桶仪式 / 祝酒启幕' }
    ],
    tags: ['精酿啤酒节', '厦门', '爵对好势2026', '磐基中心'],
    isTemplate: true,
    createdAt: '2026-05-20T00:00:00Z'
  },
  {
    id: 'tpl_music_night',
    type: 'music_festival',
    title: '周末音乐现场',
    subtitle: '精酿 x 音乐 微醺之夜',
    coverImage: '',
    startDate: '2026-06-07',
    endDate: '2026-06-07',
    location: 'TWO GIRLS 铁路公园店',
    description: `每周六晚，在1955铁路公园火车车厢中，享受现场音乐与精酿啤酒的完美碰撞。
独立乐队演出 + 精酿特调 + 限定小吃`,
    benefits: [
      { title: '独立乐队现场演出', icon: '🎸' },
      { title: '精酿特调饮品买一送一', icon: '🍺' },
      { title: '限量版周边抽奖', icon: '🎁' }
    ],
    tags: ['音乐现场', '周末', '铁路公园', '独立乐队'],
    isTemplate: true,
    createdAt: '2026-06-01T00:00:00Z'
  },
  {
    id: 'tpl_pop_up_summer',
    type: 'pop_up',
    title: '夏日快闪打卡站',
    subtitle: '来TWO GIRLS打卡，赢取限量周边',
    coverImage: '',
    startDate: '2026-06-15',
    endDate: '2026-08-31',
    location: '全部门店联动',
    description: `消费者到店购买任意产品，并在美团/大众点评/抖音/小红书/微信朋友圈等社交平台发布相关图文视频，即可获赠精美礼品一份！
PS：推广活动赠品由厂牌提供，请门店保存相关打卡截图，联系客服核销。`,
    benefits: [
      { title: '社交媒体打卡赠饮', icon: '📱' },
      { title: '限量品牌周边', icon: '👕' },
      { title: '门店专属优惠券', icon: '🎟️' },
      { title: '月度最佳打卡奖励', icon: '🏆' }
    ],
    tags: ['快闪', '打卡', '夏日', '社交裂变', '小红书'],
    isTemplate: true,
    createdAt: '2026-06-01T00:00:00Z'
  }
];

// 内存中的活动数据（带持久化）
let eventsData = loadCustomData('events.json', []);
// 活动ID计数器
let eventIdCounter = eventsData.length > 0 ? Math.max(...eventsData.map(e => parseInt(e._counter || 0))) + 1 : 1;

// 内存中的对话历史 (agentId -> messages[])
let chatHistories = {};
const MAX_CHAT_HISTORY = 100;

// 每日汇报数据 (agentId -> latest report)
let dailyReports = {};

// ========== 资源库系统 ==========
// 资源分类定义
const RESOURCE_CATEGORIES = [
  { id: 'company', name: '公司资料', icon: '🏢', color: '#E91E63', description: '品牌信息、组织架构、制度文件等' },
  { id: 'product', name: '产品资料', icon: '🍺', color: '#FF9800', description: '酒单、菜单、产品规格、酿造记录等' },
  { id: 'marketing', name: '营销资料', icon: '📢', color: '#2196F3', description: '活动方案、内容模板、推广素材、KOL合作等' },
  { id: 'supply', name: '供应链资料', icon: '📦', color: '#4CAF50', description: '供应商信息、采购记录、库存数据、物流配置等' },
  { id: 'finance', name: '财务资料', icon: '💰', color: '#9C27B0', description: '报表模板、对账记录、税务文件等' },
  { id: 'hr', name: '人力资源', icon: '👔', color: '#009688', description: '员工档案、排班模板、培训资料等' },
  { id: 'tech', name: '技术资料', icon: '⚙️', color: '#607D8B', description: '系统架构、API文档、部署配置等' },
  { id: 'other', name: '其他资料', icon: '📁', color: '#795548', description: '其他内部知识库文档' }
];

// 预置资源模板（一键添加）
const RESOURCE_TEMPLATES = {
  company: [
    { title: '品牌手册', content: '# TWO GIRLS 品牌手册\n\n## 品牌故事\nEst.2012，两女孩精酿始于厦门...\n\n## 品牌定位\n精酿啤酒 × CBBQ × 社交空间\n\n## 品牌视觉\n- 主色: #E91E63 (品牌粉)\n- Logo: 麦穗+啤酒杯圆形徽章\n- Slogan: THE LIFETIME OF LOVE', tags: ['品牌', '手册', '核心'], source: '内部编制' },
    { title: '组织架构', content: '# 组织架构\n\n## 管理层\n- 创始人/CEO: \n- COO:\n- CMO:\n\n## 部门\n- 运营部 (门店+线上)\n- 供应链部\n- 营销部\n- 财务部\n- HR部', tags: ['组织', '管理'], source: '内部编制' },
    { title: '门店SOP手册', content: '# 门店标准作业程序\n\n## 开店流程\n1. 09:30 到岗打卡\n2. 09:45 设备检查\n3. 10:00 卫生清洁\n...\n\n## 关店流程\n1. 23:00 停止接单\n2. 23:30 设备清洗\n...', tags: ['SOP', '门店', '运营'], source: '内部编制' }
  ],
  product: [
    { title: '生啤酒单(27龙头)', content: '# 门店生啤酒单\n\n## 1-13号龙头\n| 编号 | 酒名 | 风格 | ABV | 价格 |\n|------|------|------|-----|------|\n| 1 | 双倍干投浑浊 | IPA | 6.3% | ¥35 |\n...\n\n## 14-27号龙头\n...', tags: ['酒单', '产品', '生啤'], source: '吧台系统' },
    { title: '酿造工艺手册', content: '# 精酿酿造工艺\n\n## 酿造流程\n1. 麦芽研磨\n2. 糖化\n3. 过滤\n4. 煮沸\n5. 冷却\n6. 发酵\n7. 成熟\n8. 装罐/装桶\n\n## 质量控制标准\n...', tags: ['酿造', '工艺', 'QC'], source: '酿造团队' },
    { title: 'CBBQ烧烤菜单', content: '# CBBQ 烧烤菜单\n\n## 烤串类\n- 牛肉串 ¥15\n- 羊肉串 ¥12\n...\n\n## 烤肉类\n- 厚切牛排 ¥128\n...', tags: ['菜单', 'BBQ', '产品'], source: '后厨团队' }
  ],
  marketing: [
    { title: '小红书内容模板库', content: '# 小红书内容模板\n\n## 新品发布模板\n**标题**: 🍺新酒上线！XX精酿来了\n**封面**: 酒款+门店环境\n**正文**: ...\n\n## 活动预热模板\n...', tags: ['小红书', '模板', '内容'], source: '营销团队' },
    { title: '会员活动方案库', content: '# 会员活动方案库\n\n## 月度会员日\n- 每月15日\n- 全场8折\n- 专属品鉴\n\n## 生日特权\n...', tags: ['会员', '活动', '方案'], source: '营销团队' },
    { title: 'KOL合作档案', content: '# KOL合作档案\n\n## 合作达人列表\n| 达人 | 平台 | 粉丝 | 合作次数 |\n|------|------|------|----------|\n...\n\n## 合作流程\n...', tags: ['KOL', '合作', '推广'], source: '营销团队' }
  ],
  supply: [
    { title: '供应商名录', content: '# 供应商名录\n\n## 麦芽供应商\n- 供应商A: 进口麦芽\n- 供应商B: 国产麦芽\n\n## 酒花供应商\n...\n\n## 物料供应商\n...', tags: ['供应商', '采购'], source: '供应链团队' },
    { title: '库存管理规范', content: '# 库存管理规范\n\n## 生啤库存\n- 每桶容量: 20L/30L\n- 保质期: 冷藏30天\n- 安全库存: ≥2桶/款\n\n## 食材库存\n...', tags: ['库存', '管理', '规范'], source: '供应链团队' }
  ],
  finance: [
    { title: '月度财务报表模板', content: '# 月度财务报表\n\n## 营收\n| 项目 | 金额 |\n|------|------|\n| 门店营收 | |\n| 线上营收 | |\n| 活动营收 | |\n\n## 成本\n...\n\n## 利润\n...', tags: ['财务', '报表', '模板'], source: '财务团队' }
  ],
  hr: [
    { title: '员工排班模板', content: '# 员工排班模板\n\n## 班次\n- 早班: 10:00-18:00\n- 中班: 14:00-22:00\n- 晚班: 18:00-02:00\n\n## 人员配置\n...', tags: ['排班', 'HR', '模板'], source: 'HR团队' }
  ],
  tech: [
    { title: '系统架构文档', content: '# AI搭档系统架构\n\n## 技术栈\n- 前端: Vanilla HTML/CSS/JS\n- 后端: Node.js HTTP Server\n- AI引擎: OpenClaw多智能体\n\n## 部署\n...', tags: ['架构', '技术', '文档'], source: '技术团队' }
  ]
};

// 内存中的资源库数据
let resourceLibrary = [];
let resourceIdCounter = 1;

// 初始化资源库（加载预置模板）
function initResourceLibrary() {
  Object.entries(RESOURCE_TEMPLATES).forEach(([categoryId, templates]) => {
    templates.forEach(tpl => {
      resourceLibrary.push({
        id: 'res_' + resourceIdCounter++,
        category: categoryId,
        title: tpl.title,
        content: tpl.content,
        tags: tpl.tags || [],
        source: tpl.source || '',
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    });
  });
}
initResourceLibrary();

// 初始化对话历史
function initChatHistories() {
  const { AGENTS } = require('./agents/layers/index');
  AGENTS.forEach(agentId => {
    chatHistories[agentId] = [];
    dailyReports[agentId] = null;
  });
}
initChatHistories();

// 初始化：从文件系统加载prompt
function loadAgentPrompts() {
  const { AGENTS, LAYERS, readLayerFile } = require('./agents/layers/index');
  AGENTS.forEach(agentId => {
    agentPrompts[agentId] = {};
    LAYERS.forEach(layer => {
      agentPrompts[agentId][layer] = readLayerFile(agentId, layer);
    });
  });
}
loadAgentPrompts();

// 写入prompt到文件
function writeLayerFile(agentId, layer, content) {
  const fs = require('fs');
  const p = require('path');
  const layersBase = process.env.LAYERS_PATH || p.join(__dirname, 'agents', 'layers');
  const filePath = p.join(layersBase, agentId, `${layer}.md`);
  try {
    fs.writeFileSync(filePath, content, 'utf-8');
    return true;
  } catch (e) {
    return false;
  }
}

// API路由
const API_ROUTES = {
  '/api/agents': () => ({ success: true, data: getAgentList() }),
  '/api/agents/all': () => ({ success: true, data: getAllAgentsData() }),
  '/api/channels': () => ({ success: true, data: CHANNELS }),
  '/api/mcp': () => ({ success: true, data: [...MCP_CONNECTORS, ...customMcpConnectors] }),
  '/api/skills': () => ({ success: true, data: [...SKILLS, ...customSkills] }),
  '/api/cron': () => ({ success: true, data: [...CRON_JOBS, ...customCronJobs] }),
  '/api/providers': () => ({ success: true, data: providers }),
  '/api/resource-categories': () => ({ success: true, data: RESOURCE_CATEGORIES }),
  '/api/resource-templates': () => ({ success: true, data: RESOURCE_TEMPLATES }),
  '/api/dashboard': () => {
    const allMcp = [...MCP_CONNECTORS, ...customMcpConnectors];
    const allSkills = [...SKILLS, ...customSkills];
    const allCron = [...CRON_JOBS, ...customCronJobs];
    const allAgents = [...getAgentList(), ...customAgents.map(a => ({ id: a.id, name: a.name, icon: a.icon, domain: a.domain, priority: a.priority || 3, color: a.color || '#E91E63', layers: LAYERS, custom: true }))];
    return {
    success: true,
    data: {
      agents: allAgents,
      channels: channelSettings,
      mcp: allMcp,
      skills: allSkills,
      cronJobs: allCron,
      providers,
      resources: resourceLibrary,
      resourceCategories: RESOURCE_CATEGORIES,
      events: eventsData,
      eventTypes: EVENT_TYPES,
      stats: {
        totalAgents: allAgents.length,
        activeChannels: channelSettings.filter(c => c.connected).length,
        connectedMcp: allMcp.filter(m => m.connected).length,
        activeSkills: allSkills.length,
        activeCronJobs: allCron.filter(c => c.active).length,
        connectedProviders: providers.filter(p => p.connected).length,
        totalResources: resourceLibrary.length,
        totalEvents: eventsData.length
      }
    }
    };
  },
  '/api/events/types': () => ({ success: true, data: EVENT_TYPES }),
  '/api/events/templates': () => ({ success: true, data: EVENT_TEMPLATES }),
  '/api/events/statuses': () => ({ success: true, data: EVENT_STATUSES }),
  '/api/events': () => ({ success: true, data: eventsData })
};

// 动态API: /api/agents/:id/:layer
function matchDynamicRoute(url) {
  const match = url.match(/^\/api\/agents\/([a-z-]+)\/([a-z]+)$/);
  if (match) {
    const [, agentId, layer] = match;
    if (LAYERS.includes(layer)) {
      const data = getAgentLayerData(agentId);
      if (data.id) {
        return { success: true, data: { agent: data.id, name: data.name, layer, content: data.layers[layer] } };
      }
    }
  }
  return null;
}

// 读取POST请求body
function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch (e) { resolve({}); }
    });
  });
}

// ========== 智能体响应生成器 ==========
function generateAgentResponse(agentId, agentName, domain, userMessage, identityContent) {
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

  const domainResponses = {
    marketing: [
      `📊 **线上引流分析报告** (${timeStr})\n\n根据您的指令"${userMessage}"，我已分析当前流量数据：\n\n• 今日小红书曝光量: 12,850次 (+15% vs昨日)\n• 抖音视频播放: 8,420次\n• 大众点评店铺访问: 1,260次\n• 微信社群新增: 23人\n\n**建议动作：**\n1. 今晚20:00发布抖音新品种草视频\n2. 小红书增加"夏日精酿"话题标签\n3. 大众点评回复最新5条评价`,
      `🎯 **引流策略建议** (${timeStr})\n\n收到您的需求"${userMessage}"，我建议以下方案：\n\n**渠道优先级：**\n1. 🔴 小红书 - 高转化，优先投入\n2. 🟡 抖音 - 品牌曝光，内容为王\n3. 🟢 大众点评 - 口碑维护\n\n**本周KPI：** 新增到店顾客120人，线上互动率>8%`,
      `📱 **社交媒体分析** (${timeStr})\n\n关于"${userMessage}"的回应：\n\n最近7天数据趋势：\n- 粉丝增长: +342人 (目标+300)\n- 互动率: 7.2% (行业平均5.1%)\n- 引流到店转化: 4.8%\n\n**优化建议：** 增加UGC内容占比至30%，利用会员打卡活动提升自然传播`
    ],
    store: [
      `🏪 **门店运营报告** (${timeStr})\n\n关于"${userMessage}"的分析：\n\n• 今日营业额: ¥18,560 (目标¥20,000)\n• 客流量: 186人次\n• 客单价: ¥99.8\n• 翻台率: 2.4次\n• 员工在岗: 6/6人\n\n**待处理事项：** 生啤3号线需清洗，吧台灯管需更换`,
      `📋 **运营检查清单** (${timeStr})\n\n根据"${userMessage}"的指令：\n\n✅ 开店准备完成\n✅ 卫生检查通过\n⚠️ 库存预警: 桂花小麦仅剩2桶\n✅ 设备运行正常\n\n**建议：** 立即联系供应链补货桂花小麦，预计周五前到货`,
      `🏪 **巡检报告** (${timeStr})\n\n针对"${userMessage}"的执行结果：\n\n1. 前厅环境: ⭐⭐⭐⭐⭐\n2. 吧台卫生: ⭐⭐⭐⭐\n3. 后厨管理: ⭐⭐⭐⭐⭐\n4. 卫生间: ⭐⭐⭐⭐\n\n综合评分: 4.5/5.0 | 顾客满意度: 96%`
    ],
    supply: [
      `🔗 **供应链状态** (${timeStr})\n\n回应"${userMessage}"：\n\n**库存概览：**\n• 生啤库存: 5款充足, 1款预警(桂花小麦)\n• 瓶装酒: 32款, 库存健康\n• 食材: 全部在安全库存以上\n• 杯子/物料: 充足\n\n**本周采购计划：** 桂花小麦x4桶, 精酿杯x200个, 杯垫x500个`,
      `📦 **采购建议** (${timeStr})\n\n关于"${userMessage}"的分析：\n\n基于过去30天销售数据：\n- 桂花小麦日均消耗: 0.4桶 → 建议备货4桶/周\n- IPA日均消耗: 0.6桶 → 建议备货5桶/周\n- Stout日均消耗: 0.3桶 → 建议备货3桶/周\n\n**预计本周采购金额：** ¥12,800`
    ],
    event: [
      `🎪 **活动策划** (${timeStr})\n\n关于"${userMessage}"的回复：\n\n**本周活动日历：**\n• 周三: 精酿品鉴会 (已报名18人)\n• 周五: Live Music Night (爵士乐队)\n• 周六: 夏日啤酒节 (全天)\n\n**需准备物料：** 品鉴杯x30, 评分卡x30, 海报x5, 社交媒体预热内容x3`,
      `🎉 **活动执行方案** (${timeStr})\n\n针对"${userMessage}"：\n\n**活动名称：** 夏日精酿品鉴会\n**时间：** 本周六 19:00-22:00\n**预计人数：** 40-60人\n**预算：** ¥3,500\n\n**执行清单：**\n✅ 场地布置方案确认\n⏳ 酒单确认中\n⏳ KOL邀请待发送\n❌ 海报未设计`
    ],
    member: [
      `👥 **会员分析** (${timeStr})\n\n关于"${userMessage}"的数据：\n\n• 总会员数: 2,860人\n• 本月新增: 127人\n• 活跃会员(30天): 842人 (29.4%)\n• 沉睡会员(>90天): 1,240人\n• 高价值会员(RFM前20%): 572人\n\n**建议：** 对沉睡会员发送"回归礼"优惠券，预计可激活15-20%`,
      `💎 **会员运营建议** (${timeStr})\n\n针对"${userMessage}"的策略：\n\n**分层运营：**\n🔴 高价值会员: 专属品鉴会邀请\n🟡 活跃会员: 新品优先体验权\n🟢 新会员: 首单8折+欢迎饮品\n⚪ 沉睡会员: 回归礼包(满100减30)\n\n**本月目标：** 活跃率提升至32%，沉睡会员激活150人`
    ],
    sales: [
      `📈 **销售分析** (${timeStr})\n\n关于"${userMessage}"的报告：\n\n**今日数据：**\n• 营业额: ¥18,560\n• 订单数: 186单\n• 客单价: ¥99.8\n• 最畅销: IPA精酿 (42杯)\n• 优惠券使用: 23张\n\n**趋势：** 环比昨日 +8.2%，同比上周同期 +12.5%\n\n**预测：** 今晚预计营业额 ¥22,000-25,000`,
      `💰 **营收分析** (${timeStr})\n\n针对"${userMessage}"：\n\n**本周营收构成：**\n• 生啤销售: ¥45,200 (48%)\n• 瓶装酒: ¥18,600 (20%)\n• 餐食: ¥22,400 (24%)\n• 周边/活动: ¥8,200 (8%)\n\n**利润率：** 综合毛利率 68%，净利润率 22%\n\n**增长建议：** 提升瓶装酒占比至25%，推出会员储值卡`
    ],
    finance: [
      `💰 **财务概览** (${timeStr})\n\n关于"${userMessage}"的汇总：\n\n• 本月营收: ¥487,200\n• 本月成本: ¥156,800\n• 毛利: ¥330,400 (67.8%)\n• 运营费用: ¥198,500\n• 净利润: ¥131,900 (27.1%)\n\n**对账状态：** ✅ 昨日已对账，无差异\n**应收应付：** 供应商应付¥28,600，无逾期`,
      `📊 **财务分析** (${timeStr})\n\n针对"${userMessage}"：\n\n**现金流状况：** 健康 (现金储备¥380,000)\n**本月预算执行率：** 92% (营销略超预算)\n\n**税务提醒：** 下月15日前需完成季度申报\n**优化建议：** 考虑将部分营销费用转为会员储值抵扣`
    ],
    hr: [
      `👔 **人力概况** (${timeStr})\n\n关于"${userMessage}"：\n\n• 在职员工: 18人\n• 今日出勤: 18/18 ✅\n• 请假: 0人\n• 迟到: 0人\n\n**本周排班：** 已完成，覆盖所有班次\n**培训计划：** 周三14:00新品知识培训\n**招聘进度：** 兼职吧员面试中(2候选人)`,
      `📋 **排班管理** (${timeStr})\n\n针对"${userMessage}"：\n\n**明日排班(周二)：**\n• 早班(10:00-18:00): 4人\n• 中班(14:00-22:00): 5人\n• 晚班(18:00-02:00): 5人\n\n**人员配置检查：** ✅ 所有班次人员充足\n**加班预警：** 本周累计加班12小时，在正常范围`
    ],
    expansion: [
      `🚀 **扩张分析** (${timeStr})\n\n关于"${userMessage}"的评估：\n\n**新店选址进度：**\n• 候选A (朝阳大悦城附近): 租金¥35,000/月, 人流量高\n• 候选B (三里屯): 租金¥52,000/月, 竞争激烈\n• 候选C (望京): 租金¥28,000/月, 白领客群\n\n**推荐：** 候选A, 预计6个月回本\n\n**融资进度：** A轮融资进行中，已接触3家VC`,
      `🏗️ **扩张计划** (${timeStr})\n\n针对"${userMessage}"：\n\n**2026年扩张路线图：**\nQ2: 第二家店开业 (朝阳)\nQ3: 第三家店筹备 (海淀)\nQ4: 品牌VI升级 + 线上商城上线\n\n**关键里程碑：**\n✅ 品牌标准化手册完成\n⏳ 供应链中央厨房选址中\n❌ 加盟体系未建立`
    ]
  };

  // 根据领域选择响应模板
  const responses = domainResponses[domain] || [
    `🤖 **${agentName} 响应** (${timeStr})\n\n已收到您的消息："${userMessage}"\n\n我正在分析相关数据并制定方案。基于当前系统状态，建议如下：\n\n• 数据采集: 进行中\n• 分析引擎: 运行正常\n• 策略生成: 等待确认\n\n请提供更多上下文或确认执行方案。`
  ];

  // 随机选择一个响应
  return responses[Math.floor(Math.random() * responses.length)];
}

function generateDailyReport(agentId, meta, dateStr, timeStr) {
  const agentName = meta.name || agentId;
  const domain = meta.domain || 'general';

  const reportTemplates = {
    marketing: `📊 **${agentName} · 每日汇报**\n📅 ${dateStr} ${timeStr}\n\n**今日引流数据：**\n• 小红书曝光: 12,850次 ↑15%\n• 抖音播放: 8,420次 ↑8%\n• 大众点评访问: 1,260次 →\n• 社群新增: 23人 ↑12%\n\n**内容发布：** 3篇 (小红书2 + 抖音1)\n**引流到店：** 预计42人\n**广告消耗：** ¥380\n\n**明日计划：** 发布新品品鉴视频，开启周末活动预热`,
    store: `🏪 **${agentName} · 每日汇报**\n📅 ${dateStr} ${timeStr}\n\n**今日运营数据：**\n• 营业额: ¥18,560\n• 客流量: 186人次\n• 客单价: ¥99.8\n• 翻台率: 2.4次\n\n**设备状态：** ✅ 全部正常\n**卫生检查：** ⭐⭐⭐⭐⭐\n**库存预警：** 桂花小麦仅剩2桶\n\n**待办事项：** 更换吧台灯管，联系补货`,
    supply: `🔗 **${agentName} · 每日汇报**\n📅 ${dateStr} ${timeStr}\n\n**库存状态：**\n• 生啤: 6款中1款预警\n• 食材: 安全库存以上\n• 物料: 充足\n\n**今日采购：** 桂花小麦x4桶, ¥3,200\n**明日预计采购：** 杯垫x500, ¥250\n**供应商沟通：** 3家, 全部正常\n\n**供应链评分：** A级 (准时率100%)`,
    event: `🎪 **${agentName} · 每日汇报**\n📅 ${dateStr} ${timeStr}\n\n**本周活动进度：**\n• 周三品鉴会: 报名18人, 物料准备中\n• 周五Live Night: 乐队确认, 宣传启动\n• 周六啤酒节: 方案审核中\n\n**活动物料状态：** 品鉴杯✅ 海报⏳ 评分卡✅\n**KOL合作：** 3位确认出席\n\n**预算执行：** ¥2,100/¥3,500 (60%)`,
    member: `👥 **${agentName} · 每日汇报**\n📅 ${dateStr} ${timeStr}\n\n**会员数据：**\n• 总数: 2,860人\n• 今日新增: 8人\n• 活跃率(30天): 29.4%\n• 沉睡激活: 5人\n\n**优惠券发放：** 23张, 使用率65%\n**会员日活动：** 报名32人\n\n**明日计划：** 沉睡会员回归礼推送`,
    sales: `📈 **${agentName} · 每日汇报**\n📅 ${dateStr} ${timeStr}\n\n**今日销售：**\n• 营业额: ¥18,560 (目标¥20,000, 达成93%)\n• 订单: 186单\n• 客单价: ¥99.8\n• 最畅销: IPA精酿 42杯\n\n**周累计：** ¥132,400 (目标¥140,000, 达成95%)\n**月累计：** ¥487,200\n\n**明日预测：** ¥19,000-22,000`,
    finance: `💰 **${agentName} · 每日汇报**\n📅 ${dateStr} ${timeStr}\n\n**今日财务：**\n• 营收: ¥18,560\n• 成本: ¥5,940\n• 毛利: ¥12,620 (68%)\n• 费用: ¥7,200\n• 净利: ¥5,420\n\n**对账：** ✅ 已完成, 无差异\n**现金流：** ¥380,000\n\n**待付：** 供应商¥28,600 (账期30天)`,
    hr: `👔 **${agentName} · 每日汇报**\n📅 ${dateStr} ${timeStr}\n\n**出勤情况：**\n• 应到: 18人\n• 实到: 18人\n• 出勤率: 100%\n• 加班: 累计2小时\n\n**排班状态：** ✅ 明日排班已确认\n**培训：** 新品知识培训完成\n**招聘：** 兼职吧员面试中(2人)\n\n**员工满意度：** 4.2/5.0`,
    expansion: `🚀 **${agentName} · 每日汇报**\n📅 ${dateStr} ${timeStr}\n\n**扩张进度：**\n• 候选A调研: 完成, 推荐\n• 品牌手册: ✅ 完成\n• 融资: 接触3家VC\n\n**关键决策待定：** 第二店选址确认\n**竞争分析：** 竞品3公里内2家, 差异化明显\n\n**下一步：** 与候选A业主洽谈租约`
  };

  const report = reportTemplates[domain] || `🤖 **${agentName} · 每日汇报**\n📅 ${dateStr} ${timeStr}\n\n系统运行正常，各项指标在预期范围内。\n详情请查看各模块详细数据。`;

  return {
    agentId,
    agentName,
    domain,
    date: dateStr,
    time: timeStr,
    content: report
  };
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // API路由
  if (pathname.startsWith('/api/')) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    // ========== 认证 API ==========
    // POST /api/auth/register - 用户注册
    if (pathname === '/api/auth/register' && req.method === 'POST') {
      const body = await parseBody(req);
      const result = auth.register(body);
      res.writeHead(result.success ? 201 : 400);
      res.end(JSON.stringify(result));
      return;
    }

    // POST /api/auth/login - 用户登录
    if (pathname === '/api/auth/login' && req.method === 'POST') {
      const body = await parseBody(req);
      const result = auth.login(body);
      res.writeHead(result.success ? 200 : 401);
      res.end(JSON.stringify(result));
      return;
    }

    // POST /api/auth/logout - 退出登录
    if (pathname === '/api/auth/logout' && req.method === 'POST') {
      const body = await parseBody(req);
      const token = body.token || req.headers['authorization']?.replace('Bearer ', '');
      const result = auth.logout(token);
      res.writeHead(200);
      res.end(JSON.stringify(result));
      return;
    }

    // GET /api/auth/me - 获取当前用户信息
    if (pathname === '/api/auth/me' && req.method === 'GET') {
      const token = url.searchParams.get('token') || req.headers['authorization']?.replace('Bearer ', '');
      const result = auth.getCurrentUser(token);
      res.writeHead(result.success ? 200 : 401);
      res.end(JSON.stringify(result));
      return;
    }

    // GET /api/auth/roles - 获取所有角色定义
    if (pathname === '/api/auth/roles' && req.method === 'GET') {
      const result = auth.getRoles();
      res.writeHead(200);
      res.end(JSON.stringify(result));
      return;
    }

    // GET /api/auth/users - 获取用户列表（管理员权限）
    if (pathname === '/api/auth/users' && req.method === 'GET') {
      const token = url.searchParams.get('token') || req.headers['authorization']?.replace('Bearer ', '');
      const result = auth.getUsers(token);
      res.writeHead(result.success ? 200 : 403);
      res.end(JSON.stringify(result));
      return;
    }

    // ========== AI提供商 CRUD ==========
    // POST /api/providers - 添加新提供商
    if (pathname === '/api/providers' && req.method === 'POST') {
      const body = await parseBody(req);
      if (body.name && body.provider) {
        const newProvider = {
          id: 'custom_' + Date.now(),
          name: body.name,
          icon: body.icon || '🔌',
          provider: body.provider,
          models: body.models || [],
          apiKey: body.apiKey || '',
          endpoint: body.endpoint || '',
          connected: false,
          defaultModel: body.defaultModel || (body.models && body.models[0]) || ''
        };
        providers.push(newProvider);
        res.writeHead(201);
        res.end(JSON.stringify({ success: true, data: newProvider }));
      } else {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, error: '缺少必填字段: name, provider' }));
      }
      return;
    }
    
    // PUT /api/providers/:id - 更新提供商
    const providerUpdateMatch = pathname.match(/^\/api\/providers\/(.+)$/);
    if (providerUpdateMatch && req.method === 'PUT') {
      const providerId = providerUpdateMatch[1];
      const body = await parseBody(req);
      const idx = providers.findIndex(p => p.id === providerId);
      if (idx !== -1) {
        providers[idx] = { ...providers[idx], ...body, id: providers[idx].id };
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: providers[idx] }));
      } else {
        res.writeHead(404);
        res.end(JSON.stringify({ success: false, error: 'Provider not found' }));
      }
      return;
    }
    
    // DELETE /api/providers/:id - 删除提供商
    if (providerUpdateMatch && req.method === 'DELETE') {
      const providerId = providerUpdateMatch[1];
      const idx = providers.findIndex(p => p.id === providerId);
      if (idx !== -1 && providers[idx].id.startsWith('custom_')) {
        providers.splice(idx, 1);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true }));
      } else if (idx !== -1) {
        res.writeHead(403);
        res.end(JSON.stringify({ success: false, error: '不能删除内置提供商' }));
      } else {
        res.writeHead(404);
        res.end(JSON.stringify({ success: false, error: 'Provider not found' }));
      }
      return;
    }
    
    // ========== 自定义AI搭档 CRUD ==========
    // GET /api/custom-agents - 获取自定义AI搭档列表
    if (pathname === '/api/custom-agents' && req.method === 'GET') {
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, data: customAgents }));
      return;
    }

    // POST /api/custom-agents - 添加自定义AI搭档
    if (pathname === '/api/custom-agents' && req.method === 'POST') {
      const body = await parseBody(req);
      if (!body.name) {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, error: '缺少名称' }));
        return;
      }
      const newAgent = {
        id: 'custom_agent_' + agentIdCounter,
        _counter: agentIdCounter,
        name: body.name,
        icon: body.icon || '🤖',
        domain: body.domain || 'custom',
        description: body.description || '',
        priority: body.priority || 3,
        color: body.color || '#E91E63',
        identityPrompt: body.identityPrompt || '',
        memoryPrompt: body.memoryPrompt || '',
        soulPrompt: body.soulPrompt || '',
        userPrompt: body.userPrompt || '',
        agentPrompt: body.agentPrompt || '',
        toolsPrompt: body.toolsPrompt || '',
        createdAt: Date.now()
      };
      agentIdCounter++;
      customAgents.push(newAgent);
      saveCustomData('custom_agents.json', customAgents);
      
      // 初始化prompts和对话历史
      agentPrompts[newAgent.id] = {
        identity: newAgent.identityPrompt || `# ${newAgent.name} 身份\n\n自定义AI搭档`,
        memory: newAgent.memoryPrompt || '',
        soul: newAgent.soulPrompt || '',
        user: newAgent.userPrompt || '',
        agent: newAgent.agentPrompt || '',
        tools: newAgent.toolsPrompt || ''
      };
      chatHistories[newAgent.id] = [];
      dailyReports[newAgent.id] = null;
      
      res.writeHead(201);
      res.end(JSON.stringify({ success: true, data: newAgent }));
      return;
    }

    // DELETE /api/custom-agents/:id - 删除自定义AI搭档
    const agentDeleteMatch = pathname.match(/^\/api\/custom-agents\/(.+)$/);
    if (agentDeleteMatch && req.method === 'DELETE') {
      const agentId = agentDeleteMatch[1];
      const idx = customAgents.findIndex(a => a.id === agentId);
      if (idx !== -1) {
        customAgents.splice(idx, 1);
        saveCustomData('custom_agents.json', customAgents);
        delete agentPrompts[agentId];
        delete chatHistories[agentId];
        delete dailyReports[agentId];
        res.writeHead(200);
        res.end(JSON.stringify({ success: true }));
      } else {
        res.writeHead(404);
        res.end(JSON.stringify({ success: false, error: 'Agent not found' }));
      }
      return;
    }

    // ========== 自定义MCP连接器 CRUD ==========
    // POST /api/mcp/custom - 添加自定义MCP
    if (pathname === '/api/mcp/custom' && req.method === 'POST') {
      const body = await parseBody(req);
      if (!body.name) {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, error: '缺少名称' }));
        return;
      }
      const newMcp = {
        id: 'custom_mcp_' + Date.now(),
        name: body.name,
        icon: body.icon || '🔌',
        category: body.category || '自定义',
        description: body.description || '',
        endpoint: body.endpoint || '',
        config: body.config || {},
        connected: false,
        createdAt: Date.now()
      };
      customMcpConnectors.push(newMcp);
      saveCustomData('mcp_connectors.json', customMcpConnectors);
      res.writeHead(201);
      res.end(JSON.stringify({ success: true, data: newMcp }));
      return;
    }

    // DELETE /api/mcp/custom/:id - 删除自定义MCP
    const mcpDeleteMatch = pathname.match(/^\/api\/mcp\/custom\/(.+)$/);
    if (mcpDeleteMatch && req.method === 'DELETE') {
      const mcpId = mcpDeleteMatch[1];
      const idx = customMcpConnectors.findIndex(m => m.id === mcpId);
      if (idx !== -1) {
        customMcpConnectors.splice(idx, 1);
        saveCustomData('mcp_connectors.json', customMcpConnectors);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true }));
      } else {
        res.writeHead(404);
        res.end(JSON.stringify({ success: false, error: 'MCP not found' }));
      }
      return;
    }

    // PUT /api/mcp/custom/:id - 更新自定义MCP
    if (mcpDeleteMatch && req.method === 'PUT') {
      const mcpId = mcpDeleteMatch[1];
      const body = await parseBody(req);
      const idx = customMcpConnectors.findIndex(m => m.id === mcpId);
      if (idx !== -1) {
        customMcpConnectors[idx] = { ...customMcpConnectors[idx], ...body, id: customMcpConnectors[idx].id };
        saveCustomData('mcp_connectors.json', customMcpConnectors);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: customMcpConnectors[idx] }));
      } else {
        res.writeHead(404);
        res.end(JSON.stringify({ success: false, error: 'MCP not found' }));
      }
      return;
    }

    // ========== 自定义Skills CRUD ==========
    // POST /api/skills/custom - 添加自定义Skill
    if (pathname === '/api/skills/custom' && req.method === 'POST') {
      const body = await parseBody(req);
      if (!body.name) {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, error: '缺少名称' }));
        return;
      }
      const newSkill = {
        id: 'skill_custom_' + Date.now(),
        name: body.name,
        icon: body.icon || '🧩',
        source: body.source || 'custom',
        description: body.description || '',
        category: body.category || '通用',
        openclawPath: body.openclawPath || '',
        clawhubUrl: body.clawhubUrl || '',
        githubUrl: body.githubUrl || '',
        promptTemplate: body.promptTemplate || '',
        createdAt: Date.now()
      };
      customSkills.push(newSkill);
      saveCustomData('custom_skills.json', customSkills);
      res.writeHead(201);
      res.end(JSON.stringify({ success: true, data: newSkill }));
      return;
    }

    // DELETE /api/skills/custom/:id - 删除自定义Skill
    const skillDeleteMatch = pathname.match(/^\/api\/skills\/custom\/(.+)$/);
    if (skillDeleteMatch && req.method === 'DELETE') {
      const skillId = skillDeleteMatch[1];
      const idx = customSkills.findIndex(s => s.id === skillId);
      if (idx !== -1) {
        customSkills.splice(idx, 1);
        saveCustomData('custom_skills.json', customSkills);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true }));
      } else {
        res.writeHead(404);
        res.end(JSON.stringify({ success: false, error: 'Skill not found' }));
      }
      return;
    }

    // PUT /api/skills/custom/:id - 更新自定义Skill
    if (skillDeleteMatch && req.method === 'PUT') {
      const skillId = skillDeleteMatch[1];
      const body = await parseBody(req);
      const idx = customSkills.findIndex(s => s.id === skillId);
      if (idx !== -1) {
        customSkills[idx] = { ...customSkills[idx], ...body, id: customSkills[idx].id };
        saveCustomData('custom_skills.json', customSkills);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: customSkills[idx] }));
      } else {
        res.writeHead(404);
        res.end(JSON.stringify({ success: false, error: 'Skill not found' }));
      }
      return;
    }

    // ========== 自定义定时任务 CRUD ==========
    // POST /api/cron/custom - 添加自定义定时任务
    if (pathname === '/api/cron/custom' && req.method === 'POST') {
      const body = await parseBody(req);
      if (!body.name) {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, error: '缺少名称' }));
        return;
      }
      const newCron = {
        id: 'cron_custom_' + Date.now(),
        name: body.name,
        expr: body.expr || '',
        desc: body.desc || '',
        agent: body.agent || '',
        active: body.active !== undefined ? body.active : true,
        category: body.category || '自定义',
        createdAt: Date.now()
      };
      customCronJobs.push(newCron);
      saveCustomData('custom_cron_jobs.json', customCronJobs);
      res.writeHead(201);
      res.end(JSON.stringify({ success: true, data: newCron }));
      return;
    }

    // DELETE /api/cron/custom/:id - 删除自定义定时任务
    const cronDeleteMatch = pathname.match(/^\/api\/cron\/custom\/(.+)$/);
    if (cronDeleteMatch && req.method === 'DELETE') {
      const cronId = cronDeleteMatch[1];
      const idx = customCronJobs.findIndex(c => c.id === cronId);
      if (idx !== -1) {
        customCronJobs.splice(idx, 1);
        saveCustomData('custom_cron_jobs.json', customCronJobs);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true }));
      } else {
        res.writeHead(404);
        res.end(JSON.stringify({ success: false, error: 'Cron job not found' }));
      }
      return;
    }

    // PUT /api/cron/custom/:id - 更新自定义定时任务
    if (cronDeleteMatch && req.method === 'PUT') {
      const cronId = cronDeleteMatch[1];
      const body = await parseBody(req);
      const idx = customCronJobs.findIndex(c => c.id === cronId);
      if (idx !== -1) {
        customCronJobs[idx] = { ...customCronJobs[idx], ...body, id: customCronJobs[idx].id };
        saveCustomData('custom_cron_jobs.json', customCronJobs);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: customCronJobs[idx] }));
      } else {
        res.writeHead(404);
        res.end(JSON.stringify({ success: false, error: 'Cron job not found' }));
      }
      return;
    }

    // ========== 文件上传 API ==========
    // POST /api/resources/upload - 上传文件
    if (pathname === '/api/resources/upload' && req.method === 'POST') {
      const uploadDir = path.join(getCustomDataDir(), 'uploads');
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
      
      const contentType = req.headers['content-type'] || '';
      if (contentType.includes('multipart/form-data')) {
        // 简单multipart解析
        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => {
          const buffer = Buffer.concat(chunks);
          const boundary = contentType.split('boundary=')[1];
          if (!boundary) {
            res.writeHead(400);
            res.end(JSON.stringify({ success: false, error: 'Invalid multipart data' }));
            return;
          }
          
          const parts = buffer.toString('binary').split('--' + boundary);
          const uploadedFiles = [];
          
          parts.forEach(part => {
            if (part.includes('Content-Disposition') && part.includes('filename=')) {
              const filenameMatch = part.match(/filename="(.+?)"/);
              const filename = filenameMatch ? filenameMatch[1] : 'file_' + Date.now();
              const contentStart = part.indexOf('\r\n\r\n');
              if (contentStart !== -1) {
                let content = part.substring(contentStart + 4);
                if (content.endsWith('\r\n')) content = content.substring(0, content.length - 2);
                const filePath = path.join(uploadDir, Date.now() + '_' + filename);
                fs.writeFileSync(filePath, Buffer.from(content, 'binary'));
                uploadedFiles.push({ filename, path: filePath, size: Buffer.from(content, 'binary').length });
              }
            }
          });
          
          res.writeHead(200);
          res.end(JSON.stringify({ success: true, data: { files: uploadedFiles } }));
        });
      } else if (contentType.includes('application/json')) {
        // Base64文件上传
        const body = await parseBody(req);
        if (!body.filename || !body.data) {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, error: '缺少filename或data字段' }));
          return;
        }
        const filePath = path.join(uploadDir, Date.now() + '_' + body.filename);
        const buffer = Buffer.from(body.data, 'base64');
        fs.writeFileSync(filePath, buffer);
        
        // 同时创建资源记录
        const category = body.category || 'other';
        const title = body.title || body.filename;
        const newResource = {
          id: 'res_' + resourceIdCounter++,
          category,
          title,
          content: body.description || `上传文件: ${body.filename}`,
          tags: body.tags || [],
          source: body.source || '文件上传',
          filePath: filePath,
          fileType: body.fileType || path.extname(body.filename),
          fileSize: buffer.length,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        resourceLibrary.push(newResource);
        
        res.writeHead(201);
        res.end(JSON.stringify({ success: true, data: { resource: newResource, file: { filename: body.filename, path: filePath, size: buffer.length } } }));
      } else {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, error: 'Unsupported content type' }));
      }
      return;
    }

    // GET /api/resources/file/:filename - 获取上传的文件
    const fileDownloadMatch = pathname.match(/^\/api\/resources\/file\/(.+)$/);
    if (fileDownloadMatch && req.method === 'GET') {
      const filename = decodeURIComponent(fileDownloadMatch[1]);
      const uploadDir = path.join(getCustomDataDir(), 'uploads');
      const filePath = path.join(uploadDir, filename);
      if (fs.existsSync(filePath)) {
        const ext = path.extname(filename).toLowerCase();
        const mimeTypes = {
          '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
          '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.webm': 'video/webm',
          '.pdf': 'application/pdf', '.doc': 'application/msword', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          '.xls': 'application/vnd.ms-excel', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          '.ppt': 'application/vnd.ms-powerpoint', '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        };
        res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
        res.end(fs.readFileSync(filePath));
      } else {
        res.writeHead(404);
        res.end(JSON.stringify({ success: false, error: 'File not found' }));
      }
      return;
    }

    // POST /api/resources/structured - 结构化输出API（给智能体调用）
    if (pathname === '/api/resources/structured' && req.method === 'POST') {
      const body = await parseBody(req);
      const { agentId, query, format } = body;
      // 根据query搜索资源库，返回结构化数据
      let results = [...resourceLibrary];
      if (query) {
        const q = query.toLowerCase();
        results = results.filter(r =>
          r.title.toLowerCase().includes(q) ||
          r.content.toLowerCase().includes(q) ||
          r.tags.some(t => t.toLowerCase().includes(q))
        );
      }
      // 限制返回数量
      results = results.slice(0, 20);
      // 结构化输出
      const structured = {
        query,
        totalMatches: results.length,
        timestamp: Date.now(),
        agent: agentId || 'unknown',
        format: format || 'json',
        data: results.map(r => ({
          id: r.id,
          title: r.title,
          category: r.category,
          summary: r.content.substring(0, 300),
          tags: r.tags,
          source: r.source,
          fileType: r.fileType || null,
          updatedAt: r.updatedAt
        }))
      };
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, data: structured }));
      return;
    }

    // ========== AI搭档Prompt设置 CRUD ==========
    // GET /api/prompts/:agentId - 获取指定智能体的6层prompt
    const promptGetMatch = pathname.match(/^\/api\/prompts\/([a-z-]+)$/);
    if (promptGetMatch && req.method === 'GET') {
      const agentId = promptGetMatch[1];
      if (agentPrompts[agentId]) {
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: { agentId, layers: agentPrompts[agentId] } }));
      } else {
        res.writeHead(404);
        res.end(JSON.stringify({ success: false, error: 'Agent not found' }));
      }
      return;
    }

    // PUT /api/prompts/:agentId/:layer - 更新指定智能体某层的prompt
    const promptPutMatch = pathname.match(/^\/api\/prompts\/([a-z-]+)\/([a-z]+)$/);
    if (promptPutMatch && req.method === 'PUT') {
      const [, agentId, layer] = promptPutMatch;
      if (!agentPrompts[agentId]) {
        res.writeHead(404);
        res.end(JSON.stringify({ success: false, error: 'Agent not found' }));
        return;
      }
      if (!LAYERS.includes(layer)) {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, error: 'Invalid layer' }));
        return;
      }
      const body = await parseBody(req);
      if (body.content !== undefined) {
        agentPrompts[agentId][layer] = body.content;
        // 持久化到文件
        const saved = writeLayerFile(agentId, layer, body.content);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: { agentId, layer, content: body.content, saved } }));
      } else {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, error: '缺少content字段' }));
      }
      return;
    }

    // ========== 频道设置 CRUD ==========
    // GET /api/channel-settings - 获取频道设置
    if (pathname === '/api/channel-settings' && req.method === 'GET') {
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, data: channelSettings }));
      return;
    }

    // PUT /api/channel-settings/:id - 更新频道设置
    const channelPutMatch = pathname.match(/^\/api\/channel-settings\/(.+)$/);
    if (channelPutMatch && req.method === 'PUT') {
      const channelId = channelPutMatch[1];
      const body = await parseBody(req);
      const idx = channelSettings.findIndex(c => c.id === channelId);
      if (idx !== -1) {
        channelSettings[idx] = { ...channelSettings[idx], ...body, id: channelSettings[idx].id };
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: channelSettings[idx] }));
      } else {
        res.writeHead(404);
        res.end(JSON.stringify({ success: false, error: 'Channel not found' }));
      }
      return;
    }

    // POST /api/channel-settings - 添加自定义频道
    if (pathname === '/api/channel-settings' && req.method === 'POST') {
      const body = await parseBody(req);
      if (body.name && body.type) {
        const newChannel = {
          id: 'custom_ch_' + Date.now(),
          name: body.name,
          icon: body.icon || '📡',
          type: body.type,
          connected: false,
          config: body.config || {}
        };
        channelSettings.push(newChannel);
        res.writeHead(201);
        res.end(JSON.stringify({ success: true, data: newChannel }));
      } else {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, error: '缺少必填字段: name, type' }));
      }
      return;
    }

    // DELETE /api/channel-settings/:id - 删除自定义频道
    if (channelPutMatch && req.method === 'DELETE') {
      const channelId = channelPutMatch[1];
      const idx = channelSettings.findIndex(c => c.id === channelId);
      if (idx !== -1 && channelSettings[idx].id.startsWith('custom_ch_')) {
        channelSettings.splice(idx, 1);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true }));
      } else if (idx !== -1) {
        res.writeHead(403);
        res.end(JSON.stringify({ success: false, error: '不能删除内置频道' }));
      } else {
        res.writeHead(404);
        res.end(JSON.stringify({ success: false, error: 'Channel not found' }));
      }
      return;
    }

    // ========== AI对话 API ==========
    // GET /api/chat/:agentId - 获取指定智能体对话历史
    const chatGetMatch = pathname.match(/^\/api\/chat\/([a-z-]+)$/);
    if (chatGetMatch && req.method === 'GET') {
      const agentId = chatGetMatch[1];
      if (chatHistories[agentId]) {
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: { agentId, messages: chatHistories[agentId] } }));
      } else {
        res.writeHead(404);
        res.end(JSON.stringify({ success: false, error: 'Agent not found' }));
      }
      return;
    }

    // POST /api/chat/:agentId - 发送消息给指定智能体
    if (chatGetMatch && req.method === 'POST') {
      const agentId = chatGetMatch[1];
      if (!chatHistories[agentId]) {
        res.writeHead(404);
        res.end(JSON.stringify({ success: false, error: 'Agent not found' }));
        return;
      }
      const body = await parseBody(req);
      if (!body.message) {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, error: '缺少message字段' }));
        return;
      }
      const { AGENT_META } = require('./agents/layers/index');
      let meta = AGENT_META[agentId] || {};
      // 如果是自定义agent，从customAgents中查找
      if (!meta.name) {
        const customAgent = customAgents.find(a => a.id === agentId);
        if (customAgent) {
          meta = { name: customAgent.name, icon: customAgent.icon, domain: customAgent.domain || 'general', priority: customAgent.priority || 3, color: customAgent.color || '#E91E63' };
        }
      }

      // 保存用户消息
      const userMsg = { role: 'user', content: body.message, time: Date.now() };
      chatHistories[agentId].push(userMsg);

      // 生成AI响应（基于agent的prompt层模拟智能响应）
      const agentPromptsData = agentPrompts[agentId] || {};
      const identityContent = agentPromptsData.identity || '';
      const agentName = meta.name || agentId;

      // 根据agent领域生成对应的响应内容
      const responseContent = generateAgentResponse(agentId, agentName, meta.domain || 'general', body.message, identityContent);

      const aiMsg = { role: 'assistant', content: responseContent, time: Date.now() };
      chatHistories[agentId].push(aiMsg);

      // 限制历史长度
      if (chatHistories[agentId].length > MAX_CHAT_HISTORY) {
        chatHistories[agentId] = chatHistories[agentId].slice(-MAX_CHAT_HISTORY);
      }

      res.writeHead(200);
      res.end(JSON.stringify({ success: true, data: { message: aiMsg, agentId } }));
      return;
    }

    // DELETE /api/chat/:agentId - 清除对话历史
    if (chatGetMatch && req.method === 'DELETE') {
      const agentId = chatGetMatch[1];
      if (chatHistories[agentId]) {
        chatHistories[agentId] = [];
        res.writeHead(200);
        res.end(JSON.stringify({ success: true }));
      } else {
        res.writeHead(404);
        res.end(JSON.stringify({ success: false, error: 'Agent not found' }));
      }
      return;
    }

    // ========== 每日汇报 API ==========
    // POST /api/report/daily/all - 一键生成所有智能体每日汇报（必须放在 :agentId 前面）
    if (pathname === '/api/report/daily/all' && req.method === 'POST') {
      const { AGENT_META } = require('./agents/layers/index');
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
      const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

      const reports = {};
      Object.keys(dailyReports).forEach(agentId => {
        let meta = AGENT_META[agentId] || {};
        if (!meta.name) {
          const customAgent = customAgents.find(a => a.id === agentId);
          if (customAgent) meta = { name: customAgent.name, icon: customAgent.icon, domain: customAgent.domain || 'general' };
        }
        reports[agentId] = generateDailyReport(agentId, meta, dateStr, timeStr);
        dailyReports[agentId] = reports[agentId];
      });

      res.writeHead(200);
      res.end(JSON.stringify({ success: true, data: { date: dateStr, time: timeStr, reports } }));
      return;
    }

    // POST /api/report/daily/:agentId - 生成指定智能体每日汇报
    const reportMatch = pathname.match(/^\/api\/report\/daily\/([a-z-]+)$/);
    if (reportMatch && req.method === 'POST') {
      const agentId = reportMatch[1];
      if (!dailyReports.hasOwnProperty(agentId)) {
        res.writeHead(404);
        res.end(JSON.stringify({ success: false, error: 'Agent not found' }));
        return;
      }
      const { AGENT_META } = require('./agents/layers/index');
      let meta = AGENT_META[agentId] || {};
      if (!meta.name) {
        const customAgent = customAgents.find(a => a.id === agentId);
        if (customAgent) meta = { name: customAgent.name, icon: customAgent.icon, domain: customAgent.domain || 'general' };
      }
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
      const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

      const report = generateDailyReport(agentId, meta, dateStr, timeStr);
      dailyReports[agentId] = report;

      res.writeHead(200);
      res.end(JSON.stringify({ success: true, data: report }));
      return;
    }

    // GET /api/report/daily/:agentId - 获取最新汇报
    if (reportMatch && req.method === 'GET') {
      const agentId = reportMatch[1];
      if (dailyReports.hasOwnProperty(agentId)) {
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: dailyReports[agentId] }));
      } else {
        res.writeHead(404);
        res.end(JSON.stringify({ success: false, error: 'Agent not found' }));
      }
      return;
    }

    // ========== 资源库 CRUD API ==========
    // GET /api/resources - 获取所有资源（支持 ?category=xxx 筛选）
    if (pathname === '/api/resources' && req.method === 'GET') {
      const category = url.searchParams.get('category');
      const search = url.searchParams.get('search');
      let result = [...resourceLibrary];
      if (category && category !== 'all') {
        result = result.filter(r => r.category === category);
      }
      if (search) {
        const q = search.toLowerCase();
        result = result.filter(r =>
          r.title.toLowerCase().includes(q) ||
          r.content.toLowerCase().includes(q) ||
          r.tags.some(t => t.toLowerCase().includes(q))
        );
      }
      // 按更新时间倒序
      result.sort((a, b) => b.updatedAt - a.updatedAt);
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, data: result }));
      return;
    }

    // POST /api/resources - 添加资源
    if (pathname === '/api/resources' && req.method === 'POST') {
      const body = await parseBody(req);
      if (!body.title) {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, error: '缺少title字段' }));
        return;
      }
      const newResource = {
        id: 'res_' + resourceIdCounter++,
        category: body.category || 'other',
        title: body.title,
        content: body.content || '',
        tags: body.tags || [],
        source: body.source || '手动添加',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      resourceLibrary.push(newResource);
      res.writeHead(201);
      res.end(JSON.stringify({ success: true, data: newResource }));
      return;
    }

    // POST /api/resources/batch-add - 一键批量添加模板资源
    if (pathname === '/api/resources/batch-add' && req.method === 'POST') {
      const body = await parseBody(req);
      const category = body.category;
      if (!category || !RESOURCE_TEMPLATES[category]) {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, error: '无效的分类' }));
        return;
      }
      const templates = RESOURCE_TEMPLATES[category];
      const added = [];
      templates.forEach(tpl => {
        // 避免重复添加
        const exists = resourceLibrary.find(r => r.title === tpl.title && r.category === category);
        if (!exists) {
          const newRes = {
            id: 'res_' + resourceIdCounter++,
            category: category,
            title: tpl.title,
            content: tpl.content,
            tags: tpl.tags || [],
            source: tpl.source || '',
            createdAt: Date.now(),
            updatedAt: Date.now()
          };
          resourceLibrary.push(newRes);
          added.push(newRes);
        }
      });
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, data: { added: added.length, total: resourceLibrary.length, items: added } }));
      return;
    }

    // POST /api/resources/batch-add-all - 一键添加全部模板资源
    if (pathname === '/api/resources/batch-add-all' && req.method === 'POST') {
      let totalAdded = 0;
      Object.entries(RESOURCE_TEMPLATES).forEach(([category, templates]) => {
        templates.forEach(tpl => {
          const exists = resourceLibrary.find(r => r.title === tpl.title && r.category === category);
          if (!exists) {
            resourceLibrary.push({
              id: 'res_' + resourceIdCounter++,
              category,
              title: tpl.title,
              content: tpl.content,
              tags: tpl.tags || [],
              source: tpl.source || '',
              createdAt: Date.now(),
              updatedAt: Date.now()
            });
            totalAdded++;
          }
        });
      });
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, data: { added: totalAdded, total: resourceLibrary.length } }));
      return;
    }

    // PUT/DELETE /api/resources/:id - 更新/删除单个资源
    const resourceMatch = pathname.match(/^\/api\/resources\/(.+)$/);
    if (resourceMatch) {
      const resId = resourceMatch[1];
      const idx = resourceLibrary.findIndex(r => r.id === resId);

      if (req.method === 'PUT') {
        if (idx === -1) {
          res.writeHead(404);
          res.end(JSON.stringify({ success: false, error: 'Resource not found' }));
          return;
        }
        const body = await parseBody(req);
        resourceLibrary[idx] = {
          ...resourceLibrary[idx],
          ...body,
          id: resourceLibrary[idx].id,
          updatedAt: Date.now()
        };
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: resourceLibrary[idx] }));
        return;
      }

      if (req.method === 'DELETE') {
        if (idx === -1) {
          res.writeHead(404);
          res.end(JSON.stringify({ success: false, error: 'Resource not found' }));
          return;
        }
        resourceLibrary.splice(idx, 1);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true }));
        return;
      }

      if (req.method === 'GET') {
        if (idx === -1) {
          res.writeHead(404);
          res.end(JSON.stringify({ success: false, error: 'Resource not found' }));
          return;
        }
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: resourceLibrary[idx] }));
        return;
      }
    }

    // ========== 活动发布 CRUD ==========
    const eventMatch = pathname.match(/^\/api\/events\/(event_\w+)$/);

    // GET /api/events/:id - 获取单个活动详情
    if (eventMatch && req.method === 'GET') {
      const eventId = eventMatch[1];
      const event = eventsData.find(e => e.id === eventId);
      if (event) {
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: event }));
      } else {
        res.writeHead(404);
        res.end(JSON.stringify({ success: false, error: '活动不存在' }));
      }
      return;
    }

    // POST /api/events - 创建新活动
    if (pathname === '/api/events' && req.method === 'POST') {
      const body = await parseBody(req);
      if (!body.title || !body.type) {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, error: '缺少必要字段: title, type' }));
        return;
      }
      const newEvent = {
        id: 'event_' + Date.now(),
        _counter: eventIdCounter++,
        type: body.type,
        title: body.title,
        subtitle: body.subtitle || '',
        coverImage: body.coverImage || '',
        startDate: body.startDate || '',
        endDate: body.endDate || '',
        location: body.location || '',
        description: body.description || '',
        benefits: body.benefits || [],
        stores: body.stores || null,
        schedule: body.schedule || [],
        tags: body.tags || [],
        status: body.status || 'draft',
        shareText: body.shareText || '',
        qrCodeUrl: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      eventsData.push(newEvent);
      saveCustomData('events.json', eventsData);
      res.writeHead(201);
      res.end(JSON.stringify({ success: true, data: newEvent }));
      return;
    }

    // PUT /api/events/:id - 更新活动
    if (eventMatch && req.method === 'PUT') {
      const eventId = eventMatch[1];
      const body = await parseBody(req);
      const idx = eventsData.findIndex(e => e.id === eventId);
      if (idx !== -1) {
        eventsData[idx] = { ...eventsData[idx], ...body, id: eventId, updatedAt: new Date().toISOString() };
        saveCustomData('events.json', eventsData);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: eventsData[idx] }));
      } else {
        res.writeHead(404);
        res.end(JSON.stringify({ success: false, error: '活动不存在' }));
      }
      return;
    }

    // DELETE /api/events/:id - 删除活动
    if (eventMatch && req.method === 'DELETE') {
      const eventId = eventMatch[1];
      const idx = eventsData.findIndex(e => e.id === eventId);
      if (idx !== -1) {
        eventsData.splice(idx, 1);
        saveCustomData('events.json', eventsData);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true }));
      } else {
        res.writeHead(404);
        res.end(JSON.stringify({ success: false, error: '活动不存在' }));
      }
      return;
    }

    // POST /api/events/publish - 发布活动（草稿→已发布）
    if (pathname === '/api/events/publish' && req.method === 'POST') {
      const body = await parseBody(req);
      const eventId = body.id;
      if (!eventId) {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, error: '缺少活动ID' }));
        return;
      }
      const idx = eventsData.findIndex(e => e.id === eventId);
      if (idx === -1) {
        res.writeHead(404);
        res.end(JSON.stringify({ success: false, error: '活动不存在' }));
        return;
      }
      eventsData[idx].status = 'published';
      eventsData[idx].updatedAt = new Date().toISOString();
      saveCustomData('events.json', eventsData);
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, data: eventsData[idx] }));
      return;
    }

    // POST /api/events/qrcode - 生成分享二维码
    if (pathname === '/api/events/qrcode' && req.method === 'POST') {
      try {
        const body = await parseBody(req);
        const { text, size = 300 } = body;

        // 构建分享内容
        let qrContent = text || '';
        if (!qrContent) {
          const eventId = body.eventId;
          if (eventId) {
            const evt = eventsData.find(e => e.id === eventId);
            if (evt) {
              // 生成包含活动信息的分享文本
              const shareInfo = `${evt.title}\n${evt.subtitle || ''}\n\n📅 ${evt.startDate}${evt.endDate ? ' ~ ' + evt.endDate : ''}\n📍 ${evt.location}\n\n${evt.description?.slice(0, 100) || ''}`;
              qrContent = `https://twogirls.brew/event/${evt.id.replace('event_', '')}`;
              // 将详细信息存为备注
              evt._shareInfo = shareInfo;
              evt._shareQrContent = qrContent;
              saveCustomData('events.json', eventsData);
            }
          }
        }

        if (!qrContent) {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, error: '无法生成二维码：缺少内容' }));
          return;
        }

        // 使用 qrcode 库生成 Data URL
        const qrDataUrl = await QRCode.toDataURL(qrContent, {
          width: Math.min(size, 800),
          margin: 2,
          color: {
            dark: '#000000',
            light: '#ffffff'
          },
          errorCorrectionLevel: 'M'
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          data: {
            qrDataUrl,
            content: qrContent,
            size
          }
        }));
      } catch (err) {
        console.error('[QR Code Error]', err.message);
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: '二维码生成失败: ' + err.message }));
      }
      return;
    }

    // POST /api/events/clone-from-template - 从模板创建活动
    if (pathname === '/api/events/clone-template' && req.method === 'POST') {
      const body = await parseBody(req);
      const templateId = body.templateId;
      if (!templateId) {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, error: '缺少模板ID' }));
        return;
      }

      const template = EVENT_TEMPLATES.find(t => t.id === templateId);
      if (!template) {
        res.writeHead(404);
        res.end(JSON.stringify({ success: false, error: '模板不存在' }));
        return;
      }

      const newEvent = {
        id: 'event_' + Date.now(),
        _counter: eventIdCounter++,
        type: template.type,
        title: body.title || template.title,
        subtitle: template.subtitle || '',
        coverImage: body.coverImage || template.coverImage || '',
        startDate: body.startDate || template.startDate || '',
        endDate: body.endDate || template.endDate || '',
        location: body.location || template.location || '',
        description: template.description || '',
        benefits: template.benefits || [],
        stores: template.stores || null,
        schedule: template.schedule || [],
        tags: template.tags || [],
        status: 'draft',
        shareText: '',
        clonedFrom: templateId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      eventsData.push(newEvent);
      saveCustomData('events.json', eventsData);
      res.writeHead(201);
      res.end(JSON.stringify({ success: true, data: newEvent }));
      return;
    }

    // 静态API
    if (API_ROUTES[pathname]) {
      res.writeHead(200);
      res.end(JSON.stringify(API_ROUTES[pathname]()));
      return;
    }
    
    // 动态API
    const dynamicResult = matchDynamicRoute(pathname);
    if (dynamicResult) {
      res.writeHead(200);
      res.end(JSON.stringify(dynamicResult));
      return;
    }
    
    res.writeHead(404);
    res.end(JSON.stringify({ success: false, error: 'API not found' }));
    return;
  }

  // 静态文件服务
  let filePath = pathname === '/' ? '/login.html' : pathname;
  filePath = path.join(PUBLIC_PATH, filePath);

  const ext = path.extname(filePath);
  const contentType = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // 回退到dashboard.html (SPA)
      fs.readFile(path.join(PUBLIC_PATH, 'dashboard.html'), (err2, data2) => {
        if (err2) {
          res.writeHead(404);
          res.end('Not Found');
        } else {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(data2);
        }
      });
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    }
  });
});

// 启动服务器，处理端口占用
function startServer(port) {
  server.listen(port, () => {
    console.log(`\n🍺 Two Girls Brew 后台管理系统已启动`);
    console.log(`   http://localhost:${port}\n`);
    console.log(`   API: http://localhost:${port}/api/dashboard`);
    console.log(`   智能体: http://localhost:${port}/api/agents`);
    console.log(`   频道: http://localhost:${port}/api/channels`);
    console.log(`   MCP: http://localhost:${port}/api/mcp`);
    console.log(`   技能: http://localhost:${port}/api/skills`);
    console.log(`   定时任务: http://localhost:${port}/api/cron\n`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`⚠️ 端口 ${port} 已被占用，尝试自动释放...`);
      // 尝试杀掉占用端口的进程（仅在 Electron 打包环境下）
      try {
        const { execSync } = require('child_process');
        const result = execSync(`lsof -ti:${port}`, { encoding: 'utf-8', timeout: 3000 }).trim();
        if (result) {
          const pids = result.split('\n');
          const ourPid = String(process.pid);
          pids.forEach(pid => {
            if (pid && pid !== ourPid) {
              try {
                process.kill(parseInt(pid), 'SIGTERM');
                console.log(`✅ 已终止占用端口的进程 PID:${pid}`);
              } catch (killErr) {
                // 进程可能已经不存在
              }
            }
          });
        }
      } catch (execErr) {
        // lsof 可能不可用，尝试换端口
      }
      // 等待端口释放后重试
      setTimeout(() => {
        console.log(`🔄 重新尝试绑定端口 ${port}...`);
        server.close();
        server.listen(port, () => {
          console.log(`✅ 端口 ${port} 已释放，服务器重新启动成功`);
        });
      }, 1000);
    } else {
      console.error('❌ 服务器启动失败:', err.message);
      process.exit(1);
    }
  });
}

startServer(PORT);

module.exports = server;
