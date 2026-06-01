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
  '/api/mcp': () => ({ success: true, data: MCP_CONNECTORS }),
  '/api/skills': () => ({ success: true, data: SKILLS }),
  '/api/cron': () => ({ success: true, data: CRON_JOBS }),
  '/api/providers': () => ({ success: true, data: providers }),
  '/api/resource-categories': () => ({ success: true, data: RESOURCE_CATEGORIES }),
  '/api/resource-templates': () => ({ success: true, data: RESOURCE_TEMPLATES }),
  '/api/dashboard': () => ({
    success: true,
    data: {
      agents: getAgentList(),
      channels: channelSettings,
      mcp: MCP_CONNECTORS,
      skills: SKILLS,
      cronJobs: CRON_JOBS,
      providers,
      resources: resourceLibrary,
      resourceCategories: RESOURCE_CATEGORIES,
      stats: {
        totalAgents: 9,
        activeChannels: channelSettings.filter(c => c.connected).length,
        connectedMcp: MCP_CONNECTORS.filter(m => m.connected).length,
        activeSkills: SKILLS.length,
        activeCronJobs: CRON_JOBS.filter(c => c.active).length,
        connectedProviders: providers.filter(p => p.connected).length,
        totalResources: resourceLibrary.length
      }
    }
  })
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
      const meta = AGENT_META[agentId] || {};

      // 保存用户消息
      const userMsg = { role: 'user', content: body.message, time: Date.now() };
      chatHistories[agentId].push(userMsg);

      // 生成AI响应（基于agent的prompt层模拟智能响应）
      const agentPromptsData = agentPrompts[agentId] || {};
      const identityContent = agentPromptsData.identity || '';
      const agentName = meta.name || agentId;

      // 根据agent领域生成对应的响应内容
      const responseContent = generateAgentResponse(agentId, agentName, meta.domain, body.message, identityContent);

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
        const meta = AGENT_META[agentId] || {};
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
      const meta = AGENT_META[agentId] || {};
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

server.listen(PORT, () => {
  console.log(`\n🍺 Two Girls Brew 后台管理系统已启动`);
  console.log(`   http://localhost:${PORT}\n`);
  console.log(`   API: http://localhost:${PORT}/api/dashboard`);
  console.log(`   智能体: http://localhost:${PORT}/api/agents`);
  console.log(`   频道: http://localhost:${PORT}/api/channels`);
  console.log(`   MCP: http://localhost:${PORT}/api/mcp`);
  console.log(`   技能: http://localhost:${PORT}/api/skills`);
  console.log(`   定时任务: http://localhost:${PORT}/api/cron\n`);
});

module.exports = server;
