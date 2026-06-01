/**
 * 6层智能体配置系统
 * 读取每个智能体的6层文件，为后台UI提供数据
 */
const fs = require('fs');
const path = require('path');

const AGENTS = [
  'traffic-acquisition',
  'store-operation',
  'supply-chain',
  'event-execution',
  'member-growth',
  'sales-growth',
  'finance',
  'hr',
  'expansion'
];

const LAYERS = ['identity', 'memory', 'soul', 'user', 'agent', 'tools'];

const AGENT_META = {
  'traffic-acquisition': { name: '线上引流智能体', icon: '📡', domain: 'marketing', priority: 2, color: '#E91E63' },
  'store-operation': { name: '门店运营智能体', icon: '🏪', domain: 'store', priority: 2, color: '#FF9800' },
  'supply-chain': { name: '供应链智能体', icon: '🔗', domain: 'supply', priority: 3, color: '#4CAF50' },
  'event-execution': { name: '活动执行智能体', icon: '🎪', domain: 'event', priority: 3, color: '#9C27B0' },
  'member-growth': { name: '会员增长智能体', icon: '👥', domain: 'member', priority: 3, color: '#2196F3' },
  'sales-growth': { name: '销售增长智能体', icon: '📈', domain: 'sales', priority: 1, color: '#F44336' },
  'finance': { name: '财务智能体', icon: '💰', domain: 'finance', priority: 4, color: '#009688' },
  'hr': { name: '人力资源智能体', icon: '👔', domain: 'hr', priority: 5, color: '#607D8B' },
  'expansion': { name: '扩张智能体', icon: '🚀', domain: 'expansion', priority: 5, color: '#795548' }
};

// AI服务提供商配置
const AI_PROVIDERS = [
  { id: 'openai', name: 'OpenAI', icon: '🧠', provider: 'openai', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o3-mini'], apiKey: '', endpoint: 'https://api.openai.com/v1', connected: true, defaultModel: 'gpt-4o' },
  { id: 'anthropic', name: 'Anthropic', icon: '🎯', provider: 'anthropic', models: ['claude-opus-4', 'claude-sonnet-4', 'claude-3.5-haiku'], apiKey: '', endpoint: 'https://api.anthropic.com', connected: true, defaultModel: 'claude-sonnet-4' },
  { id: 'google', name: 'Google AI', icon: '🌐', provider: 'google', models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'], apiKey: '', endpoint: 'https://generativelanguage.googleapis.com', connected: true, defaultModel: 'gemini-2.5-flash' },
  { id: 'deepseek', name: 'DeepSeek', icon: '🔍', provider: 'deepseek', models: ['deepseek-chat', 'deepseek-reasoner'], apiKey: '', endpoint: 'https://api.deepseek.com/v1', connected: false, defaultModel: 'deepseek-chat' },
  { id: 'qwen', name: '通义千问', icon: '☁️', provider: 'qwen', models: ['qwen-max', 'qwen-plus', 'qwen-turbo'], apiKey: '', endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1', connected: false, defaultModel: 'qwen-plus' },
  { id: 'zhipu', name: '智谱 GLM', icon: '📚', provider: 'zhipu', models: ['glm-4-plus', 'glm-4-flash', 'glm-4-air'], apiKey: '', endpoint: 'https://open.bigmodel.cn/api/paas/v4', connected: false, defaultModel: 'glm-4-flash' },
  { id: 'moonshot', name: 'Moonshot', icon: '🌙', provider: 'moonshot', models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'], apiKey: '', endpoint: 'https://api.moonshot.cn/v1', connected: false, defaultModel: 'moonshot-v1-32k' },
  { id: 'baidu', name: '百度文心', icon: '📖', provider: 'baidu', models: ['ernie-4.0-turbo', 'ernie-3.5', 'ernie-speed'], apiKey: '', endpoint: 'https://aip.baidubce.com', connected: false, defaultModel: 'ernie-4.0-turbo' },
  { id: 'custom_add', name: '自定义添加', icon: '➕', provider: 'custom', models: [], apiKey: '', endpoint: '', connected: false, defaultModel: '' }
];

// 频道配置
const CHANNELS = [
  { id: 'feishu', name: '飞书', icon: '🐦', type: 'im', connected: true, config: { webhook: '', appId: '' } },
  { id: 'wechat', name: '微信', icon: '💬', type: 'im', connected: true, config: { appId: '', appSecret: '' } },
  { id: 'store_miniapp', name: '门店小程序', icon: '🏪', type: 'miniapp', connected: true, config: { appId: '' } },
  { id: 'youzan', name: '有赞微商城', icon: '🛒', type: 'ecommerce', connected: true, config: { clientId: '', clientSecret: '', shopId: '' } },
  { id: 'wechat_mp', name: '公众号', icon: '📢', type: 'mp', connected: true, config: { appId: '', appSecret: '' } },
  { id: 'custom', name: '自定义MCP', icon: '➕', type: 'custom', connected: false, config: {} }
];

// MCP连接器
const MCP_CONNECTORS = [
  { id: 'xiaohongshu', name: '小红书 MCP', icon: '📕', category: '社媒', connected: true },
  { id: 'douyin', name: '抖音 MCP', icon: '🎵', category: '社媒', connected: true },
  { id: 'dianping', name: '大众点评 MCP', icon: '⭐', category: '社媒', connected: true },
  { id: 'wechat_mp_mcp', name: '微信 MCP', icon: '💬', category: '社媒', connected: true },
  { id: 'youzan_mcp', name: '有赞 MCP', icon: '🛒', category: '电商', connected: true },
  { id: 'feishu_mcp', name: '飞书 MCP', icon: '🐦', category: '协作', connected: true },
  { id: 'github', name: 'GitHub MCP', icon: '🐙', category: '开发', connected: false },
  { id: 'openclaw', name: 'OpenClaw MCP', icon: '🦞', category: 'AI', connected: true },
  { id: 'custom_add', name: '自定义添加', icon: '➕', category: '其他', connected: false }
];

// Skill扩展
const SKILLS = [
  { id: 'skill_content', name: '内容创作 Skill', icon: '✍️', source: 'builtin', description: '自动生成小红书/抖音/点评内容' },
  { id: 'skill_coupon', name: '优惠券引擎 Skill', icon: '🎫', source: 'builtin', description: '7种优惠券自动创建与分发' },
  { id: 'skill_rfm', name: 'RFM分析 Skill', icon: '📊', source: 'builtin', description: '会员RFM分群与策略推荐' },
  { id: 'skill_forecast', name: '销售预测 Skill', icon: '🔮', source: 'builtin', description: '三情景销售预测模型' },
  { id: 'skill_brew', name: '酿造追踪 Skill', icon: '🍺', source: 'builtin', description: '5批次并行酿造追踪' },
  { id: 'skill_review', name: '评价分析 Skill', icon: '💬', source: 'builtin', description: 'NLP情感分析与自动回复' },
  { id: 'skill_canva', name: 'Canva设计 Skill', icon: '🎨', source: 'github', description: '快速生成营销海报/物料' },
  { id: 'skill_jianying', name: '剪映剪辑 Skill', icon: '🎬', source: 'github', description: '短视频快速剪辑' },
  { id: 'skill_git_trend', name: 'GitHub趋势 Skill', icon: '📈', source: 'github', description: '追踪AI/技术趋势' },
  { id: 'skill_excalidraw', name: 'Excalidraw Skill', icon: '✏️', source: 'clawhub', description: '流程图/架构图绘制' },
  { id: 'skill_browser', name: '浏览器 Skill', icon: '🌐', source: 'clawhub', description: '网页自动化操作' },
  { id: 'skill_search', name: 'Exa搜索 Skill', icon: '🔍', source: 'clawhub', description: '深度网络搜索' },
  { id: 'skill_custom_add', name: '自定义添加 Skill', icon: '➕', source: 'custom', description: '添加自定义技能扩展' }
];

// 定时任务配置
const CRON_JOBS = [
  { id: 'cron_inventory', name: '库存监控', expr: '*/5 * * * *', desc: '每5分钟生啤库存监控', agent: 'supply-chain', active: true },
  { id: 'cron_order_sync', name: '订单同步', expr: '*/15 * * * *', desc: '每15分钟订单同步', agent: 'store-operation', active: true },
  { id: 'cron_health_check', name: '门店巡检', expr: '0 */2 * * *', desc: '每2小时门店巡检', agent: 'store-operation', active: true },
  { id: 'cron_reconcile', name: '每日对账', expr: '0 2 * * *', desc: '凌晨2点自动对账', agent: 'finance', active: true },
  { id: 'cron_sales_report', name: '销售报表', expr: '30 2 * * *', desc: '凌晨2:30销售日报', agent: 'sales-growth', active: true },
  { id: 'cron_content', name: '内容发布', expr: '0 10 * * *', desc: '上午10点自动内容发布', agent: 'traffic-acquisition', active: true },
  { id: 'cron_churn', name: '流失检查', expr: '0 11 * * *', desc: '上午11点会员流失检查', agent: 'member-growth', active: true },
  { id: 'cron_schedule', name: '员工排班', expr: '0 18 * * *', desc: '下午6点次日排班', agent: 'hr', active: true },
  { id: 'cron_rfm', name: 'RFM分析', expr: '0 9 * * 1', desc: '周一上午9点RFM分析', agent: 'member-growth', active: true },
  { id: 'cron_weekly_forecast', name: '销售预测', expr: '0 10 * * 1', desc: '周一上午10点周预测', agent: 'sales-growth', active: true },
  { id: 'cron_weekly_supply', name: '供应链盘点', expr: '0 15 * * 3', desc: '周三下午3点供应链盘点', agent: 'supply-chain', active: true },
  { id: 'cron_weekend_prep', name: '周末准备', expr: '0 12 * * 5', desc: '周五中午12点周末准备', agent: 'store-operation', active: true },
  { id: 'cron_monthly', name: '月度报告', expr: '0 10 1 * *', desc: '每月1日月度综合报告', agent: 'sales-growth', active: true },
  { id: 'cron_member_day', name: '会员日', expr: '0 10 15 * *', desc: '每月15日会员日活动', agent: 'member-growth', active: true },
  { id: 'cron_custom_add', name: '自定义添加', expr: '', desc: '添加自定义定时任务', agent: '', active: false }
];

function readLayerFile(agentId, layer) {
  const filePath = path.join(__dirname, agentId, `${layer}.md`);
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (e) {
    return `# ${layer}.md\n\n文件未找到: ${filePath}`;
  }
}

function getAgentLayerData(agentId) {
  const meta = AGENT_META[agentId] || {};
  const layers = {};
  LAYERS.forEach(layer => {
    layers[layer] = readLayerFile(agentId, layer);
  });
  return { id: agentId, ...meta, layers };
}

function getAllAgentsData() {
  return AGENTS.map(id => getAgentLayerData(id));
}

function getAgentList() {
  return AGENTS.map(id => {
    const meta = AGENT_META[id];
    return {
      id,
      name: meta.name,
      icon: meta.icon,
      domain: meta.domain,
      priority: meta.priority,
      color: meta.color,
      layers: LAYERS
    };
  });
}

module.exports = {
  AGENTS,
  LAYERS,
  AGENT_META,
  AI_PROVIDERS,
  CHANNELS,
  MCP_CONNECTORS,
  SKILLS,
  CRON_JOBS,
  getAgentLayerData,
  getAllAgentsData,
  getAgentList,
  readLayerFile
};
