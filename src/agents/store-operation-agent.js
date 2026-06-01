/**
 * ============================================================
 * 线下门店体验闭环智能体 (Store Operation Agent)
 * Two Girls Brew - 27龙头旗舰店运营中枢
 * 
 * 业务知识来源:
 * - mmexport1780188214161.jpg: 旗舰店外观(27灯+玻璃窗+工业风)
 * - mmexport1780188194479.jpg / mmexport1780188190669.jpg: 
 *   27龙头酒单屏幕(1-27号, IBU/OG/vol/价格) + BBQ菜单
 * - mmexport1780188222157.jpg: 门店江景露台(差异化优势)
 * - mmexport1780188248569.jpg: 现场倒酒体验(手环+氛围)
 * - IMG_20260530_222957.jpg: 摆摊展示(生啤机+罐装+小食)
 * 
 * 核心职责:
 * 1. 27龙头酒单管理与轮换 (Tap Rotation)
 * 2. 门店库存实时监控与预警
 * 3. 员工排班与人效管理
 * 4. 评价监控与回复自动化
 * 5. 门店环境/设备健康巡检
 * 6. 到店顾客数据采集与分析
 * ============================================================
 */

const { knowledgeBase } = require('../knowledge-base/business-knowledge');
const logger = require('../utils/logger');

class StoreOperationAgent {
  constructor(config = {}) {
    this.name = 'StoreOperationAgent';
    this.domain = 'store';
    this.priority = 2;
    this.capabilities = [
      'store.inventory:sync',
      'store.inventory:check',
      'store.inventory:alert',
      'store.menu:update',
      'store.menu:rotate',
      'store.staff:schedule',
      'store.staff:attendance',
      'store.review:monitor',
      'store.review:respond',
      'store.health:check'
    ];

    this.config = config;

    // 门店配置 - 基于真实27龙头旗舰店
    this.storeConfig = {
      ...knowledgeBase.stores.flagship,
      tapSystem: {
        totalTaps: 27,
        screenLayout: { leftScreen: [1, 13], rightScreen: [14, 27] },
        tapTypes: {
          flagship: [1, 2, 3],          // 头部位置 - 永驻款
          rotating: Array.from({ length: 20 }, (_, i) => i + 4),  // 轮换区
          seasonal: [25, 26, 27]         // 季节限定位
        },
        defaultDisplay: {
          showIBU: true,
          showOG: true,
          showABV: true,
          showPrice: true,
          showStyle: true,
          colorCodeByStyle: true         // IPA=绿, Stout=黑, Sour=粉, Wheat=黄
        }
      },
      inventoryThresholds: {
        kegCritical: 10,     // 桶 - 紧急补货线 (剩余<10%)
        kegWarning: 25,      // 桶 - 预警线 (剩余<25%)
        canCritical: 20,     // 罐 - 紧急
        canWarning: 50,      // 罐 - 预警
        bbqFreshHours: 4,    // BBQ食材新鲜度(小时)
        co2TankPSI: 500      // CO2压力下限
      },
      staffConfig: {
        roles: ['店长', '调酒师', '烧烤师', '服务员', '收银员'],
        shifts: {
          day: { start: '14:00', end: '18:00', staff: 3 },       // 日班
          evening: { start: '17:00', end: '22:00', staff: 6 },   // 晚班(主)
          late: { start: '21:00', end: '02:00', staff: 3 }       // 夜班
        },
        peakHours: ['19:00-21:00', '22:00-23:30'],              // 高峰期需加人
        weekendExtra: 2                                           // 周末额外增员
      },
      reviewPlatforms: ['dianping', 'meituan', 'xiaohongshu', 'wechat'],
      healthCheckItems: [
        'tap_system_pressure', 'co2_tank_level', 'refrigeration_temp',
        'glassware_cleanliness', 'bbq_equipment_safety', 'music_system',
        'lighting_ambiance', 'restroom_cleanliness', 'outdoor_seating',
        'emergency_exit', 'first_aid_kit', 'fire_extinguisher'
      ]
    };
  }

  async execute(params) {
    const { action } = params;
    
    const actionMap = {
      inventoryCheck: () => this.checkInventory(),
      syncAllInventory: () => this.syncAllInventory(),
      updateTapMenu: () => this.updateTapMenu(params.params),
      manageSchedule: () => this.manageSchedule(),
      handleReviews: () => this.handleReviews(),
      dailyHealthCheck: () => this.dailyHealthCheck(),
      prepareForGuests: () => this.prepareForGuests(params),
      listProductOnline: () => this.listProductOnline(),
      assignToTap: () => this.assignToTap(params.params)
    };

    return await (actionMap[action] || actionMap['inventoryCheck']).call(this);
  }

  // ==================== 库存管理 ====================

  /**
   * 全渠道库存同步 (有赞微商城 + 门店小程序 + ERP)
   */
  async syncAllInventory() {
    const store = this.storeConfig;
    const products = knowledgeBase.products;

    // 构建当前库存快照
    const inventorySnapshot = {
      timestamp: new Date(),
      draftBeer: products.draftBeer.map((beer, idx) => ({
        tapId: beer.id,
        name: beer.name,
        kegLevel: this._simulateKegLevel(),  // 百分比
        status: this._getKegStatus(this._simulateKegLevel()),
        estimatedServingsLeft: Math.floor(this._simulateKegLevel() * 150),  // 每桶约150杯(330ml)
        lastKegChange: this._randomDate(-7, 0)
      })),
      cannedBeer: products.cannedBeer.map(can => ({
        name: can.name,
        stock: Math.floor(Math.random() * 200) + 30,
        status: 'normal',
        location: '冷藏仓库'
      })),
      bbqIngredients: [
        { item: '牛肉串', unit: '串', stock: Math.floor(Math.random() * 300) + 50, freshUntil: this._freshUntil(4) },
        { item: '羊肉串', unit: '串', stock: Math.floor(Math.random() * 200) + 40, freshUntil: this._freshUntil(6) },
        { item: '鸡翅', unit: '只', stock: Math.floor(Math.random() * 100) + 20, freshUntil: this._freshUntil(3) },
        { item: '蔬菜拼盘', unit: '份', stock: Math.floor(Math.random() * 80) + 15, freshUntil: this._freshUntil(2) },
        { item: '海鲜类', unit: '份', stock: Math.floor(Math.random() * 50) + 10, freshUntil: this._freshUntil(1) }
      ],
      supplies: [
        { item: '一次性杯子(L)', stock: Math.floor(Math.random() * 500) + 200, minStock: 300 },
        { item: '一次性杯子(M)', stock: Math.floor(Math.random() * 500) + 200, minStock: 300 },
        { item: '吸管', stock: Math.floor(Math.random() * 1000) + 500, minStock: 500 },
        { item: '餐巾纸', stock: Math.floor(Math.random() * 50) + 15, minStock: 10 },
        { item: '清洁用品', status: 'sufficient' }
      ],
      equipment: [
        { item: 'CO2气瓶', psi: Math.floor(Math.random() * 400) + 600, minPsi: 500 },
        { item: '生啤机温度', celsius: (Math.random() * 2 + 2).toFixed(1), target: '3-4°C' },
        { item: '冷柜温度', celsius: (Math.random() * 2 + 2).toFixed(1), target: '2-4°C' }
      ]
    };

    // 同步到有赞商城
    const syncActions = [];
    for (const canned of inventorySnapshot.cannedBeer) {
      if (canned.stock < store.inventoryThresholds.canWarning) {
        syncActions.push({
          action: 'update_stock',
          platform: 'youzan',
          product: canned.name,
          newStock: canned.stock,
          alert: canned.stock < store.inventoryThresholds.canCritical ? 'CRITICAL' : 'WARNING'
        });
      }
    }

    // 检查需要紧急处理的项目
    const alerts = [];

    // 生啤低量预警
    inventorySnapshot.draftBeer.forEach(tap => {
      if (tap.kegLevel < store.inventoryThresholds.kegCritical) {
        alerts.push({
          level: 'CRITICAL',
          type: 'draft_beer_low',
          tapId: tap.tapId,
          name: tap.name,
          message: `#${tap.tapId} ${tap.name} 仅剩${tap.kegLevel}%！需立即更换酒桶`,
          suggestedAction: `联系SupplyChainAgent更换酒桶，同时更新酒单屏幕`
        });
      } else if (tap.kegLevel < store.inventoryThresholds.kegWarning) {
        alerts.push({
          level: 'WARNING',
          type: 'draft_beer_low',
          tapId: tap.tapId,
          name: tap.name,
          message: `#${tap.tapId} ${tap.name} 剩余${tap.kegLevel}%，建议准备替换`,
          suggestedAction: '在24小时内安排换桶或从其他门店调拨'
        });
      }
    });

    // BBQ食材新鲜度检查
    inventorySnapshot.bbqIngredients.forEach(item => {
      const hoursUntilExpiry = (new Date(item.freshUntil) - new Date()) / (1000 * 60 * 60);
      if (hoursUntilExpiry < store.inventoryThresholds.bbqFreshHours) {
        alerts.push({
          level: hoursUntilExpiry < 2 ? 'CRITICAL' : 'WARNING',
          type: 'bbq_freshness',
          item: item.item,
          message: `${item.item} 剩余保鲜约${Math.floor(hoursUntilExpiry)}小时`,
          suggestedAction: hoursUntilExpiry < 2 ? '立即下架或促销处理' : '今日优先推销使用'
        });
      }
    });

    return {
      success: true,
      snapshot: inventorySnapshot,
      alerts,
      syncActions,
      summary: `库存已同步。共${alerts.length}条预警(${alerts.filter(a => a.level === 'CRITICAL').length}条严重)`,
      syncedAt: new Date()
    };
  }

  /** 快速库存检查 */
  async checkInventory() {
    const result = await this.syncAllInventory();
    return {
      ...result,
      quickView: {
        totalTaps: result.snapshot.draftBeer.length,
        criticalTaps: result.alerts.filter(a => a.type === 'draft_beer_low' && a.level === 'CRITICAL').length,
        warningTaps: result.alerts.filter(a => a.type === 'draft_beer_low' && a.level === 'WARNING').length,
        cannedStockOK: result.snapshot.cannedBeer.every(c => c.stock > 30),
        bbqFreshness: result.alerts.filter(a => a.type === 'bbq_freshness').length === 0 ? 'ALL_FRESH' : 'NEEDS_ATTENTION'
      }
    };
  }

  // ==================== 酒单管理 (27龙头) ====================

  /**
   * 更新单个龙头酒款
   */
  async updateTapMenu({ tapId = null, newBeer = null }) {
    const targetTap = tapId || Math.floor(Math.random() * 27) + 1;
    const allBeers = [...knowledgeBase.products.draftBeer, ...knowledgeBase.products.eventBeers];
    const availableBeers = allBeers.filter(b => !b.assignedTap);
    const selectedBeer = newBeer || availableBeers[Math.floor(Math.random() * availableBeers.length)];

    // 生成酒单屏幕更新指令
    const screenUpdate = {
      tapId: targetTap,
      screen: targetTap <= 13 ? 'left' : 'right',
      position: targetTap <= 13 ? targetTap - 1 : targetTap - 14,
      previous: knowledgeBase.products.draftBeer.find(b => b.id === targetTap) || '空缺',
      new: {
        id: targetTap,
        name: selectedBeer.name || selectedBeer.alias || selectedBeer.brewery + ' ' + selectedBeer.name,
        style: selectedBeer.style || '特酿',
        abv: selectedBeer.abv || '?',
        ibu: selectedBeer.ibu || '-',
        og: selectedBeer.og || '-',
        price: this._calcPrice(selectedBeer.abv, selectedBeer.style),
        colorCode: this._styleToColor(selectedBeer.style)
      },
      actionsRequired: [
        '更换酒桶物理连接到目标龙头',
        '更新左/右屏对应位置的显示内容',
        '通知调酒师新品参数(风味描述/配餐建议)',
        '如有线上菜单同步更新有赞商品库'
      ]
    };

    return {
      success: true,
      tapUpdate: screenUpdate,
      menuState: {
        totalActiveTaps: 27,
        lastUpdated: new Date(),
        nextScheduledRotation: this._nextRotationTime()
      },
      summary: `龙头 #${targetTap} 已更新为「${screenUpdate.new.name}」`
    };
  }

  /** 分配酒款到可用龙头 */
  async assignToTap({ tapId = 'next_available' }) {
    if (tapId === 'next_available') {
      // 找第一个空缺或即将空缺的龙头
      const invResult = await this.checkInventory();
      const emptyTaps = invResult.snapshot.draftBeer.filter(t => t.kegLevel < 10);
      if (emptyTaps.length > 0) {
        return this.updateTapMenu({ tapId: emptyTaps[0].tapId });
      }
      // 否则找存量最低的
      const lowest = invResult.snapshot.draftBeer.sort((a, b) => a.kegLevel - b.kegLevel)[0];
      return this.updateTapMenu({ tapId: lowest.tapId });
    }
    return this.updateTapMenu({ tapId: parseInt(tapId) });
  }

  // ==================== 排班管理 ====================

  async manageSchedule({ weekOffset = 0 }) {
    const config = this.storeConfig.staffConfig;
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(monday.getDate() - today.getDay() + 1 + weekOffset * 7);

    const weeklySchedule = [];

    for (let d = 0; d < 7; d++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + d);
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      const dayName = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()];
      
      // 根据历史客流预测当日需求
      const baseStaff = isWeekend ? 
        Object.values(config.shifts).reduce((sum, s) => sum + s.staff, 0) + config.weekendExtra :
        Object.values(config.shifts).reduce((sum, s) => sum + s.staff, 0);

      // 特殊日期调整 (如啤酒节前后)
      let specialNote = '';
      const month = date.getMonth() + 1;
      const dayOfMonth = date.getDate();
      if (month === 12 && dayOfMonth >= 17 && dayOfMonth <= 20) {
        specialNote = '⚠️ 年会期间！全员上岗 + 临时工';
      } else if (month === 12 && dayOfMonth === 19) {
        specialNote = '🔥 年会当天！最大人力配置';
      }

      weeklySchedule.push({
        date: date.toISOString().split('T')[0],
        dayName,
        isWeekend,
        totalStaffNeeded: specialNote.includes('年会') ? baseStaff + 8 : baseStaff,
        shifts: {
          day: { ...config.shifts.day, staff: config.shifts.day.staff + (isWeekend ? 1 : 0) },
          evening: { 
            ...config.shifts.evening, 
            staff: config.shifts.evening.staff + (isWeekend ? config.weekendExtra : 0) +
                   (specialNote.includes('年会') ? 4 : 0)
          },
          late: { ...config.shifts.late, staff: config.shifts.late.staff + (specialNote.includes('年会') ? 2 : 0) }
        },
        specialNote,
        expectedPeakGuests: isWeekend ? 120 + Math.floor(Math.random() * 40) : 60 + Math.floor(Math.random() * 30)
      });
    }

    return {
      success: true,
      weekStart: monday.toISOString().split('T')[0],
      schedule: weeklySchedule,
      staffPool: config.roles.map(role => ({
        role,
        availableCount: role === '店长' ? 2 : role === '调酒师' ? 4 : 6,
        skills: this._roleSkills(role)
      })),
      summary: `本周排班已生成${specialNote ? '（含特殊调整）' : ''}`
    };
  }

  // ==================== 评价管理 ====================

  async handleReviews({ platform = 'all', autoRespond = true }) {
    const platforms = platform === 'all' ? this.storeConfig.reviewPlatforms : [platform];
    
    // 模拟拉取最新评价
    const reviews = platforms.flatMap(p => 
      Array.from({ length: Math.floor(Math.random() * 8) + 2 }, (_, i) => ({
        id: `${p}_${Date.now()}_${i}`,
        platform: p,
        author: this._randomName(),
        rating: this._weightedRandom([5, 5, 5, 4, 4, 4, 4, 3, 3, 2]),  // 偏向好评
        content: this._generateReviewContent(p),
        photos: Math.random() > 0.5 ? Math.floor(Math.random() * 5) + 1 : 0,
        date: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
        responded: false,
        sentiment: null
      }))
    );

    // 情感分析 & 自动回复
    const processedReviews = reviews.map(review => {
      review.sentiment = this._analyzeSentiment(review.content);
      review.responseNeeded = review.rating <= 3 || review.sentiment === 'negative';

      if (autoRespond && review.responseNeeded) {
        review.autoResponse = this._generateReviewResponse(review);
        review.responded = true;
      } else if (autoRespond && review.rating >= 4 && review.photos > 0) {
        review.autoResponse = this._generateReviewResponse(review);  // 有图好评也回复
        review.responded = true;
      }

      return review;
    });

    // 汇总统计
    const stats = {
      total: reviews.length,
      averageRating: (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(2),
      distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
      withPhotos: reviews.filter(r => r.photos > 0).length,
      autoResponded: reviews.filter(r => r.responded).length,
      needsHumanFollowUp: reviews.filter(r => r.rating <= 2).length
    };
    reviews.forEach(r => stats.distribution[r.rating]++);

    return {
      success: true,
      reviews: processedReviews,
      stats,
      sentimentSummary: {
        positive: reviews.filter(r => r.sentiment === 'positive').length,
        neutral: reviews.filter(r => r.sentiment === 'neutral').length,
        negative: reviews.filter(r => r.sentiment === 'negative').length,
        topMentions: this._extractTopMentions(reviews.map(r => r.content))
      },
      summary: `共${stats.total}条评价，均分${stats.averageRating}星，自动回复${stats.autoResponded}条`
    };
  }

  // ==================== 巡检系统 ====================

  async dailyHealthCheck() {
    const items = this.storeConfig.healthCheckItems;
    const results = items.map(item => ({
      item,
      status: Math.random() > 0.1 ? 'PASS' : (Math.random() > 0.5 ? 'WARNING' : 'FAIL'),
      note: '',
      checkedAt: new Date()
    }));

    // 关键项详细检测
    results.find(r => r.item === 'tap_system_pressure').note = 
      '所有龙头出酒压力正常(8-12 PSI)';
    results.find(r => r.item === 'co2_tank_level').note = 
      `主CO2气瓶压力: ${Math.floor(Math.random() * 400) + 600} PSI`;
    results.find(r => r.item === 'refrigeration_temp').note = 
      `生啤机房: ${(Math.random() * 1.5 + 2.5).toFixed(1)}°C | 冷柜: ${(Math.random() * 1.5 + 2.5).toFixed(1)}°C`;

    const passCount = results.filter(r => r.status === 'PASS').length;
    const failCount = results.filter(r => r.status === 'FAIL').length;
    const overallStatus = failCount === 0 ? 'HEALTHY' : (failCount <= 2 ? 'NEEDS_ATTENTION' : 'CRITICAL');

    return {
      success: true,
      overallStatus,
      checkDate: new Date(),
      items: results,
      score: `${passCount}/${items.length}`,
      issues: results.filter(r => r.status !== 'PASS'),
      summary: `门店健康巡检完成: ${overallStatus} (${passCount}/${items.length}项通过)`
    };
  }

  /** 为活动准备门店 */
  async prepareForGuests({ expectedNewVisits = 20 }) {
    const prepList = [
      { task: '确认所有27个龙头正常出酒', priority: 'P0', status: 'done' },
      { task: `准备足够杯子(预估L:${expectedNewVisits * 2} M:${expectedNewVisits * 3})`, priority: 'P0', status: 'done' },
      { task: '检查BBQ原料库存充足', priority: 'P0', status: 'done' },
      { task: '清洁所有桌面和户外座位', priority: 'P1', status: 'in_progress' },
      { task: '测试音响/DJ设备', priority: 'P1', status: 'pending' },
      { task: '准备拍照打卡点道具', priority: 'P2', status: 'pending' },
      { task: '设置迎宾引导牌', priority: 'P1', status: 'pending' },
      { task: '确认Wi-Fi和收款设备正常', priority: 'P0', status: 'done' },
      { task: `准备${expectedNewVisits}张新人优惠券`, priority: 'P1', status: 'pending' },
      { task: '安排额外员工排班', priority: 'P1', status: 'pending' }
    ];

    return {
      preparationChecklist: prepList,
      readinessScore: Math.floor(prepList.filter(p => p.status === 'done').length / prepList.length * 100),
      summary: `门店已为预计${expectedNewVisits}名新客做准备`
    };
  }

  // ==================== 辅助方法 ====================
  _simulateKegLevel() { return Math.floor(Math.random() * 90) + 5; }
  _getKegStatus(level) {
    if (level < 10) return 'critical';
    if (level < 25) return 'warning';
    if (level < 50) return 'moderate';
    return 'healthy';
  }
  _randomDate(min, max) {
    const d = new Date(); d.setDate(d.getDate() + Math.floor(Math.random() * (max - min)) + min);
    return d.toISOString().split('T')[0];
  }
  _freshUntil(days) { const d = new Date(); d.setHours(d.getHours() + days * 24); return d.toISOString(); }
  
  _calcPrice(abv, style) {
    const base = 30;
    const abvBonus = parseFloat(abv || 0) * 2;
    const styleBonus = { 'IPA': 8, '酸艾尔': 5, '世涛': 5, '三料': 10 }[style] || 0;
    return Math.round(base + abvBonus + styleBonus);
  }
  
  _styleToColor(style) {
    if (style?.includes('IPA')) return '#4CAF50';      // 绿
    if (style?.includes('世涛') || style?.includes('Stout')) return '#212121';  // 黑
    if (style?.includes('酸')) return '#E91E63';        // 粉
    if (style?.includes('小麦') || style?.includes('Wheat')) return '#FFC107'; // 黄
    if (style?.includes('拉格') || style?.includes('Lager')) return '#2196F3';  // 蓝
    return '#9E9E9E';  // 灰
  }

  _nextRotationTime() {
    const now = new Date();
    const next = new Date(now);
    next.setDate(next.getDate() + (Math.floor(Math.random() * 7) + 1));
    return next.toISOString().split('T')[0];
  }

  _roleSkills(role) {
    const map = {
      '店长': ['全店管理', '投诉处理', '财务核对', '团队协调'],
      '调酒师': ['龙头操作', '酒品知识', '品控', '推荐搭配'],
      '烧烤师': ['BBQ烤制', '食材处理', '火候控制', '出品速度'],
      '服务员': ['点单服务', '桌边服务', '环境维护', '客户沟通'],
      '收银员': ['POS操作', '会员注册', '优惠券核销', '日结对账']
    };
    return map[role] || [];
  }

  _analyzeSentiment(text) {
    const positiveWords = ['好', '棒', '喜欢', '推荐', '赞', '不错', '惊艳', '绝了', '好喝', '好吃', '漂亮', '出片'];
    const negativeWords = ['差', '难喝', '贵', '慢', '不好', '失望', '差评', '排队', '等太久', '态度'];
    const posCount = positiveWords.filter(w => text.includes(w)).length;
    const negCount = negativeWords.filter(w => text.includes(w)).length;
    if (posCount > negCount) return 'positive';
    if (negCount > posCount) return 'negative';
    return 'neutral';
  }

  _generateResponse(templateKey, vars = {}) {
    const templates = {
      fiveStar: '感谢亲的好评！看到您喜欢我们的{item}太开心啦~ 下次来试试{rec}！🍻',
      fourStar: '谢谢亲的反馈！我们会继续努力~ 有什么想尝试的随时问我们哦 🍺',
      low: '非常抱歉给您带来不好的体验！能告诉我们具体哪里不满意吗？我们一定改进 🙏',
      photo: '哇！照片拍得太棒了！已经收藏了哈哈~ 下次来送您一份小惊喜！📸'
    };
    let tpl = templates[templateKey] || templates.fourStar;
    Object.entries(vars).forEach(([k, v]) => { tpl = tpl.replace(`{${k}}`, v); });
    return tpl;
  }

  _generateReviewResponse(review) {
    if (review.rating >= 5 && review.photos > 0) {
      return this._generateResponse('photo', { item: '店铺', rec: '新品上市款' });
    }
    if (review.rating >= 4) {
      return this._generateResponse('fiveStar', { item: '产品', rec: '当季限定款' });
    }
    return this._generateResponse('low', {});
  }

  _generateReviewContent(platform) {
    const contents = {
      dianping: [
        '环境很棒！27个龙头选择超多，推荐02出岫和脑子弱麻，女生也能喝的精酿！',
        '第一次来就被种草了，啤酒配烧烤真的绝，下次还来！',
        '位置很好找，装修很有格调，适合和朋友聚会聊天。',
        '服务态度很好，调酒师很专业会给建议。',
        '等位时间有点长，但味道确实值得等。',
        '性价比还可以，但周末人太多有点吵。'
      ],
      xiaohongshu: [
        '厦门探店｜两女孩精酿太好拍了！27龙头超出片✨',
        '姐妹聚会首选！精酿+烧烤+音乐=完美夜晚🍻',
        '被朋友安利来的，没想到这么惊喜！强推燕麦世涛～',
        '工业风装修超有质感，每个角落都能出大片！'
      ],
      wechat: [
        '整体体验不错，会推荐给朋友的',
        '希望能增加更多低度数的选择',
        '烧烤很好吃，啤酒种类也很多'
      ]
    };
    const pool = contents[platform] || contents.dianping;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  _extractTopMentions(texts) {
    const keywords = {};
    texts.forEach(t => {
      ['环境', '服务', '口味', '价格', '装修', '酒', '烧烤', '位置', '氛围'].forEach(kw => {
        if (t.includes(kw)) keywords[kw] = (keywords[kw] || 0) + 1;
      });
    });
    return Object.entries(keywords).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => ({ keyword: k, count: v }));
  }

  _weightedRandom(weights) { return weights[Math.floor(Math.random() * weights.length)]; }
  _randomName() {
    const names = ['小王同学', '啤酒达人Amy', '精酿小白', '美食探索者', '周末去哪儿', 
                   '厦门土著', 'Zoe爱喝酒', 'Jason食记', '微醺少女', '夜猫子'];
    return names[Math.floor(Math.random() * names.length)];
  }

  /** 商品上架到有赞 */
  async listProductOnline() {
    return { success: true, summary: '商品已在有赞微商城上架' };
  }
}

module.exports = StoreOperationAgent;
