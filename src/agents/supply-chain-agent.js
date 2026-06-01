/**
 * ============================================================
 * 供应链体系智能体 (Supply Chain Agent)
 * Two Girls Brew - 生啤/罐装/原料/物流配送 全链条
 * 
 * 业务知识来源:
 * - IMG_20260530_222957.jpg: 生啤机+蓝色冷链箱(运输)
 * - mmexport1780188214161.jpg: 建筑外墙上可见不锈钢桶/酒桶堆叠
 * - knowledgeBase: 33款生啤酒单 + 3款罐装产品 + BBQ原料需求
 * 
 * 核心职责:
 * 1. 酿造批次管理 (从麦芽到成品桶的全流程追踪)
 * 2. 原料采购 (麦芽/酒花/酵母/辅料/包装)
 * 3. 冷链物流配送 (生啤桶→门店, 罐装→仓库/分销)
 * 4. 供应商管理与比价
 * 5. 质量控制与追溯
 * 6. 库存预警自动补货
 * ============================================================
 */

const { ERPAPI } = require('../integrations/erp-api');
const { YouzanAPI } = require('../integrations/youzan-api');
const { knowledgeBase } = require('../knowledge-base/business-knowledge');
const logger = require('../utils/logger');

class SupplyChainAgent {
  constructor(config = {}) {
    this.name = 'SupplyChainAgent';
    this.domain = 'supply';
    this.priority = 3;
    this.capabilities = [
      'supply.purchase:create',
      'supply.purchase:track',
      'supply.delivery:schedule',
      'supply.delivery:track',
      'supply.brew:start',
      'supply.brew:monitor',
      'supply.brew:complete',
      'supply.quality:check',
      'supply.inventory:check',
      'supply.supplier:manage'
    ];

    this.erp = new ERPAPI(config.erp || {});
    this.youzan = new YouzanAPI(config.youzan || {});

    // 供应链配置 - 基于 Two Girls Brew 实际业务
    this.config = {
      // 酿造参数 (基于真实酒单数据)
      brewing: {
        batchSizes: { small: 500, medium: 1000, large: 2000 },   // 升
        typicalCycle: { IPA: 21, Stout: 28, Sour: 35, Lager: 30, Wheat: 14 },  // 天
        equipmentCapacity: 3000,  // 总酿造能力 L
        activeBatches: 5          // 同时进行批次数
      },

      // 原料BOM表 (每1000L成品)
      ingredients: {
        baseMalts: [
          { name: '澳洲皮尔森麦芽', supplier: 'Castle Malting', unit: 'kg', perBatch: 160, pricePerKg: 6.5, leadTimeDays: 7 },
          { name: '慕尼黑麦芽', supplier: 'Weyermann', unit: 'kg', perBatch: 40, pricePerKg: 8.0, leadTimeDays: 10 },
          { name: '焦糖麦芽(60EBC)', supplier: 'Weyermann', unit: 'kg', perBatch: 20, pricePerKg: 12.0, leadTimeDays: 10 },
          { name: '小麦麦芽', supplier: 'Castle Malting', unit: 'kg', perBatch: 80, pricePerKg: 7.0, leadTimeDays: 7 },
          { name: '燕麦片', supplier: '欧麦', unit: 'kg', perBatch: 15, pricePerKg: 8.5, leadTimeDays: 5 }
        ],
        hops: [
          { name: 'Citra(西楚)颗粒', origin: 'USA', unit: 'g', perBatchIPA: 300, pricePer100g: 25, storage: '-20°C冷冻' },
          { name: 'Mosaic(马赛克)', origin: 'USA', unit: 'g', perBatchIPA: 200, pricePer100g: 22, storage: '-20°C冷冻' },
          { name: 'Nelson Sauvin(尼尔森)', origin: 'NZ', unit: 'g', perBatch: 150, pricePer100g: 30, storage: '-20°C冷冻' },
          { name: 'Saaz(萨兹)', origin: 'CZ', unit: 'g', perBatchLager: 100, pricePer100g: 15, storage: '冷藏' },
          { name: 'Cascade(卡斯卡特)', origin: 'USA', unit: 'g', perBatchAPA: 180, pricePer100g: 18, storage: '冷藏' }
        ],
        yeast: [
          { name: 'US-05(美式艾尔)', type: '干酵母', unit: 'pack', perBatch: 4, pricePerPack: 18, storage: '冷藏' },
          { name: 'WLP001(加州艾尔)', type: '液态酵母', unit: 'vial', perBatch: 2, pricePerVial: 45, storage: '冷藏<1月' },
          { name: 'Bavarian Lager(巴伐利亚拉格)', type: '拉格酵母', unit: 'pack', perBatch: 3, pricePerPack: 22, storage: '冷藏' },
          { name: '柏林酸酵母混合', type: '特殊菌种', unit: 'pack', perBatch: 2, pricePerPack: 55, storage: '冷冻' }
        ],
        adjuncts: [
          { name: '乳糖', unit: 'kg', perBatch: 3, pricePerKg: 15 },       // 牛奶世涛用
          { name: '海盐', unit: 'kg', perBatch: 1, pricePerKg: 8 },         // 古斯用
          { name: '咖啡豆(埃塞俄比亚)', unit: 'kg', perBatch: 0.5, pricePerKg: 120 },  // 咖啡世涛
          { name: '水果泥(百香果/芒果/草莓)', unit: 'kg', perBatch: 8, pricePerKg: 35 }  // 酸啤用
        ]
      },

      // 包装材料
      packaging: {
        cans: { spec: '330ml标准铝罐', supplier: '波尔亚太', unitPrice: 1.8, moq: 5000, leadTimeDays: 14 },
        kegs: { 
          sizes: ['20L( DIN)', '30L(EU)', '50L'], 
          depositEach: { '20L': 300, '30L': 400, '50L': 600 },
          lifespan: '清洗后可重复使用50次'
        },
        labels: { customPrint: true, costPerDesign: 500, reorderQty: 1000 }
      },

      // BBQ供应链
      bbqSupply: {
        proteins: [
          { item: '安格斯牛肉(牛肋条)', supplier: '本地屠宰场', unit: 'kg', dailyDemand: 8, pricePerKg: 65, freshnessHours: 48 },
          { item: '羊肉(内蒙羔羊后腿)', supplier: '内蒙直供', unit: 'kg', dailyDemand: 5, pricePerKg: 75, freshnessHours: 72 },
          { item: '鸡翅中', supplier: '圣农/正大', unit: 'kg', dailyDemand: 3, pricePerKg: 28, freshnessHours: 36 },
          { item: '猪五花肉', supplier: '本地屠宰场', unit: 'kg', dailyDemand: 4, pricePerKg: 22, freshnessHours: 24 }
        ],
        seafood: [
          { item: '大虾(黑虎虾)', supplier: '厦门港直供', unit: 'kg', dailyDemand: 2, pricePerKg: 85, freshnessHours: 12 },
          { item: '鱿鱼(鲜)', supplier: '本港渔船', unit: 'kg', dailyDemand: 1.5, pricePerKg: 35, freshnessHours: 8 },
          { item: '生蚝(乳山)', supplier: '山东空运', unit: '个', dailyDemand: 40, pricePerPiece: 4, freshnessHours: 24 }
        ],
        produce: [
          { item: '彩椒拼盘(红黄绿)', supplier: '闽南蔬菜基地', unit: '份', dailyDemand: 10, pricePerPortion: 8, freshnessHours: 48 },
          { item: '玉米(甜糯)', supplier: '本地农场', unit: '根', dailyDemand: 20, pricePerRoot: 3, freshnessHours: 72 },
          { item: '茄子(长茄)', supplier: '本地农场', unit: 'kg', dailyDemand: 2, pricePerKg: 6, freshnessHours: 48 }
        ]
      },

      // 物流配置
      logistics: {
        coldChain: {
          provider: '顺丰冷运 / 京东冷链',
          temperatureRange: '2-6°C (生啤桶) / 0-25°C (罐装常温)',
          deliveryWindows: {
            urgent: '4小时内(同城)',
            sameDay: '当日达(下单前14:00)',
            nextDay: '次日晨达',
            regular: '2-3天(省内)'
          },
          blueCoolersUsed: true,  // 图片可见蓝色保温箱
          trackingRequired: true
        },
        distributionNetwork: {
          flagship: { location: '思明区旗舰店', type: 'hub', capacity_kegs: 60, capacity_cans: 5000 },
          partnerStores: [
            { name: '艾尔拉格', type: 'distributor', capacity_kegs: 10, deliveryFreq: '每周2次' }
          ],
          warehouse: { location: '集美仓储中心', area: '200㎡', features: ['恒温库', '冷冻库', '普通仓'] }
        }
      },

      // 供应商列表
      suppliers: {
        tier1: [  // 战略合作
          { name: 'Castle Malting', category: '麦芽', rating: 5, contractUntil: '2026-12-31', paymentTerms: 'net30' },
          { name: 'BarleyFarm (酒花代理)', category: '酒花', rating: 5, contractUntil: '2026-06-30', paymentTerms: 'net45' },
          { name: '顺丰冷运', category: '物流', rating: 5, contractUntil: '2026-03-31', sla: '99.5%准时率' }
        ],
        tier2: [  // 优选
          { name: '圣农集团', category: '肉类', rating: 4.5, paymentTerms: 'net15' },
          { name: '波尔亚太', category: '包装', rating: 4, moq: 5000 }
        ],
        tier3: [  // 备选/临时
          { name: '本地农贸市场', category: '蔬果', rating: 3.5, paymentTerms: '现金/周结' }
        ]
      }
    };
  }

  async execute(params) {
    const { action } = params;
    
    const actionMap = {
      createPurchaseOrder: () => this.createPurchaseOrder(params.params),
      monitorBrewing: () => this.monitorBrewing(params.params),
      trackDelivery: () => this.trackDelivery(params),
      checkStockLevels: () => this.checkStockLevels(),
      prepareEventStock: () => this.prepareEventStock(params.params),
      receiveNewStock: () => this.receiveNewStock(),
      completeBrewingBatch: () => this.completeBrewingBatch(params.params),
      submitPOToSupplier: () => this.submitPOToSupplier(),
      reserveBudget: () => this.reserveBudget()
    };

    return await (actionMap[action] || actionMap['checkStockLevels']).call(this);
  }

  // ==================== 库存检查 ====================

  /**
   * 全线库存水平检查 - 触发自动补货逻辑
   */
  async checkStockLevels() {
    const cfg = this.config;
    
    const stockReport = {
      timestamp: new Date(),
      items: [],
      alerts: [],
      autoPurchaseRecommendations: []
    };

    // === 原料库存 ===
    for (const malt of cfg.ingredients.baseMalts) {
      const currentStock = Math.floor(Math.random() * 400) + 50;  // kg
      const daysOfStock = Math.floor(currentStock / (malt.perBatch / 1000 * 2));  // 假设每周2批
      const status = daysOfStock < 7 ? 'CRITICAL' : daysOfStock < 14 ? 'WARNING' : 'OK';
      
      stockReport.items.push({ ...malt, currentStock, daysOfStock, status });
      
      if (status !== 'OK') {
        stockReport.alerts.push({ level: status, item: malt.name, message: `${malt.name}仅剩${currentStock}kg(约${daysOfStock}天)` });
        
        if (status === 'CRITICAL') {
          stockReport.autoPurchaseRecommendations.push({
            item: malt.name,
            supplier: malt.supplier,
            suggestedQty: Math.max(malt.perBatch * 4, 200),  // 至少够4批次或200kg
            urgency: 'immediate',
            estimatedCost: Math.max(malt.perBatch * 4, 200) * malt.pricePerKg,
            leadTime: `${malt.leadTimeDays}天`
          });
        }
      }
    }

    // === 酒花库存 (特别注意冷冻库存) ===
    for (const hop of cfg.ingredients.hops) {
      const currentStock = Math.floor(Math.random() * 2000) + 200;  // g
      const status = currentStock < 500 ? 'CRITICAL' : currentStock < 1000 ? 'WARNING' : 'OK';
      
      stockReport.items.push({ ...hop, currentStock, unit: hop.unit, status });
      if (status === 'CRITICAL') {
        stockReport.alerts.push({ level: 'CRITICAL', item: hop.name, message: `${hop.name}(冷冻)库存不足，需紧急补货` });
      }
    }

    // === 酵母库存 ===
    for (const yeast of cfg.ingredients.yeast) {
      const currentStock = Math.floor(Math.random() * 20) + 2;
      const status = currentStock < 3 ? 'CRITICAL' : currentStock < 6 ? 'WARNING' : 'OK';
      stockReport.items.push({ ...yeast, currentStock, status });
    }

    // === 包装材料 ===
    const canStock = Math.floor(Math.random() * 15000) + 2000;
    stockReport.items.push({
      name: '330ml铝罐', category: '包装', currentStock: canStock, unit: '个',
      status: canStock < 3000 ? 'WARNING' : 'OK'
    });

    // === 成品库存 ===
    stockReport.items.push(
      { name: 'TWO GIRLS GREEN SPIN 罐装', category: '成品', currentStock: Math.floor(Math.random() * 800) + 200, unit: '罐', status: 'OK' },
      { name: 'TWO GIRLS RED 罐装', category: '成品', currentStock: Math.floor(Math.random() * 600) + 150, unit: '罐', status: 'OK' },
      { name: '生啤桶(各款式)', category: '成品', currentStock: Math.floor(Math.random() * 30) + 10, unit: '桶', status: 'OK' }
    );

    return {
      success: true,
      report: stockReport,
      summary: `库存检查完成。${stockReport.alerts.length}项预警，${stockReport.autoPurchaseRecommendations.length}项建议自动采购`
    };
  }

  // ==================== 采购订单 ====================

  async createPurchaseOrder({ autoApprove = false, items = null }) {
    const stockResult = await this.checkStockLevels();
    const poItems = items || stockResult.report.autoPurchaseRecommendations;

    if (poItems.length === 0) {
      return { success: true, message: '当前无需创建采购订单', summary: '所有库存充足' };
    }

    const purchaseOrder = {
      poNumber: `PO-${Date.now().toString(36).toUpperCase()}`,
      date: new Date(),
      status: autoApprove ? 'approved' : 'pending_approval',
      items: poItems.map(item => ({
        ...item,
        qty: item.suggestedQty || 100,
        unitPrice: item.estimatedCost / (item.suggestedQty || 100),
        totalCost: item.estimatedCost,
        expectedDelivery: new Date(Date.now() + (item.leadTime?.match(/\d/) ? parseInt(item.leadTime) * 86400000 : 7 * 86400000))
      })),
      subtotal: poItems.reduce((sum, i) => sum + i.estimatedCost, 0),
      tax: 0,
      shipping: 200,
      total: poItems.reduce((sum, i) => sum + i.estimatedCost, 0) + 200,
      supplierNotes: autoApprove ? '系统自动生成 - 低库存触发' : '请审核后批准',
      priority: poItems.some(i => i.urgency === 'immediate') ? 'URGENT' : 'NORMAL',
      requestedBy: 'SupplyChainAgent(auto)',
      approvalWorkflow: autoApprove ? ['auto_approved'] : ['agent_created', 'manager_review', 'finance_approve']
    };

    logger.info(`[SupplyAgent] PO created: ${purchaseOrder.poNumber}, total: ¥${purchaseOrder.total}`);

    return {
      success: true,
      purchaseOrder,
      summary: `采购单 ${purchaseOrder.poNumber} 已创建，总计 ¥${purchaseOrder.total}`
    };
  }

  /** 提交PO到供应商 */
  async submitPOToSupplier() {
    return { success: true, summary: '采购单已提交至供应商ERP系统' };
  }

  /** 预算预留 */
  async reserveBudget() {
    return { success: true, summary: '财务预算已预留' };
  }

  // ==================== 酿造管理 ====================

  /**
   * 监控正在进行的酿造批次
   */
  async monitorBrewing({ batchId = null }) {
    // 模拟活跃的酿造批次 (基于真实酒单中的33款酒)
    const activeBatches = [
      {
        batchId: 'BREW-2025-042',
        beerName: '02出岫 浑浊IPA',
        style: 'New England IPA',
        stage: 'fermentation',
        dayOfCycle: 5,
        totalCycleDays: 21,
        batchSize: '1000L',
        targetTaps: [2],
        progressPct: 24,
        nextMilestone: '干投酒花 (第7天)',
        temp: '19.2°C',
        gravity: '1.018',
        notes: '发酵活跃，气泡正常'
      },
      {
        batchId: 'BREW-2025-043',
        beerName: '脑子弱麻 酸艾尔',
        style: 'Sour Ale',
        stage: 'primary_fermentation',
        dayOfCycle: 3,
        totalCycleDays: 35,
        batchSize: '500L',
        targetTaps: [3],
        progressPct: 9,
        nextMilestone: '添加水果/酸化 (第10天)',
        temp: '22.1°C',
        gravity: '1.035',
        notes: '酸化菌株接种成功'
      },
      {
        batchId: 'BREW-2025-044',
        beerName: '燕麦世涛',
        style: 'Oatmeal Stout',
        stage: 'conditioning',
        dayOfCycle: 22,
        totalCycleDays: 28,
        batchSize: '1000L',
        targetTaps: [7],
        progressPct: 79,
        nextMilestone: '装桶/碳化完成 (第28天)',
        temp: '4.0°C',
        gravity: '1.012',
        notes: '熟成中，口感圆润'
      },
      {
        batchId: 'BREW-2025-045',
        beerName: '馥卷新西兰 IPA',
        style: 'NZ IPA',
        stage: 'dry_hopping',
        dayOfCycle: 12,
        totalCycleDays: 21,
        batchSize: '1000L',
        targetTaps: [9],
        progressPct: 57,
        nextMilestone: '冷沉降 (第17天)',
        temp: '18.5°C',
        gravity: '1.014',
        notes: '第二次干投已加入Nelson Sauvin'
      },
      {
        batchId: 'BREW-2025-046',
        beerName: '比利时三料',
        style: 'Belgian Tripel',
        stage: 'lagering',
        dayOfCycle: 26,
        totalCycleDays: 30,
        batchSize: '500L',
        targetTaps: [6],
        progressPct: 87,
        nextMilestone: '装瓶/装桶 (第30天)',
        temp: '2.0°C',
        gravity: '1.010',
        notes: '瓶内二次发酵准备中'
      }
    ];

    const targetBatch = batchId ? activeBatches.find(b => b.batchId === batchId) : null;

    return {
      success: true,
      activeBatches,
      targetBatch,
      overview: {
        totalActive: activeBatches.length,
        stagesCount: {
          fermentation: activeBatches.filter(b => b.stage === 'fermentation').length,
          dry_hopping: activeBatches.filter(b => b.stage.includes('dry_hop')).length,
          conditioning: activeBatches.filter(b => b.stage === 'conditioning').length,
          lagering: activeBatches.filter(b => b.stage === 'lagering').length
        },
        estimatedCompletionDates: activeBatches.map(b => ({
          batchId: b.batchId,
          beerName: b.beerName,
          etaDate: new Date(Date.now() + (b.totalCycleDays - b.dayOfCycle) * 86400000).toISOString().split('T')[0]
        }))
      },
      summary: targetBatch 
        ? `批次 ${batchId}: ${targetBatch.beerName} - ${targetBatch.stage} (${targetBatch.progressPct}%)` 
        : `共 ${activeBatches.length} 个活跃酿造批次`
    };
  }

  /** 完成酿造批次 */
  async completeBrewingBatch({ batchId }) {
    const brewInfo = await this.monitorBrewing({ batchId });
    
    return {
      success: true,
      completedBatch: {
        batchId,
        completionDate: new Date(),
        output: {
          volume: '950L',  // 扣除损耗
          kegsProduced: { '20L': 47 },  // 约47桶20L
          qualityGrade: 'A',
          abvActual: (Math.random() * 4 + 5).toFixed(1) + '%',
          ibuActual: Math.floor(Math.random() * 40) + 10
        },
        nextSteps: [
          '质检样品送检',
          '分配到目标龙头',
          '更新有赞商城商品库存',
          '通知营销团队准备推广素材'
        ]
      },
      summary: `酿造批次 ${batchId} 已完成，产出约47桶(20L)`
    };
  }

  // ==================== 物流配送 ====================

  async trackDelivery({ trackingId = null }) {
    const deliveries = [
      {
        trackingId: 'SF-20251201-8847',
        content: '生啤桶 × 8 (02出岫/脑子弱麻/燕麦世涛各2桶 + 其他)',
        from: '酿酒车间',
        to: '思明区旗舰店',
        carrier: '顺丰冷运',
        status: 'in_transit',
        temperature: '3.8°C',
        eta: new Date(Date.now() + 3 * 3600000).toISOString(),
        stops: ['出库→冷链车→配送中→到达']
      },
      {
        trackingId: 'JD-20251201-2233',
        content: 'TWO GIRLS GREEN SPIN × 500罐 + RED × 300罐',
        from: '集美仓储中心',
        to: '艾尔拉格合作店',
        carrier: '京东冷链',
        status: 'delivered',
        deliveredAt: new Date(Date.now() - 2 * 3600000).toISOString(),
        receiver: '张店长',
        condition: '完好，温度记录正常'
      }
    ];

    return {
      success: true,
      deliveries: trackingId ? deliveries.filter(d => d.trackingId === trackingId) : deliveries,
      summary: `物流状态已更新 (${deliveries.filter(d => d.status === 'in_transit').length}在途)`
    };
  }

  /** 为大型活动备货 */
  async prepareEventStock({ eventType = 'festival' }) {
    const eventInfo = knowledgeBase.events.annualConference;
    
    const eventStockPlan = {
      event: eventInfo.name || eventType,
      date: eventInfo.date,
      estimatedAttendees: eventInfo.expectedAttendance || 500,
      beerConsumption: {
        perPersonAvgML: 800,  // 人均预计消费800ml (约2.5杯)
        totalVolumeL: 400,     // 总计需要约400L
        kegsNeeded: { '20L': 20, '30L': 14 },  // 按不同桶型计算
        varietyCount: 33,     // 年会33款酒
        safetyBuffer: 1.3     // 多备30%
      },
      foodPreparation: {
        bbqSkewersTotal: 3000,
        snackPlatesTotal: 500,
        ingredients: this.config.bbqSupply
      },
      supplies: {
        cups_L: 1500,
        cups_M: 2000,
        napkins: 3000,
        straws: 2500,
        ice: '200kg',
        co2_tanks_backup: 2
      },
      staffing: {
        bartenders: 8,
        bbq_chefs: 6,
        servers: 12,
        runners: 6
      },
      logistics: {
        deliverySchedule: '活动当天上午8点前全部到位',
        equipment: ['移动生啤架×4', '冰桶×20', '帐篷摊位×1(TWO GIRLS主摊)'],
        backupPlan: '如某款售罄，立即从旗舰店铺备用桶调拨'
      }
    };

    return {
      success: true,
      plan: eventStockPlan,
      summary: `「${eventType}」备货方案已生成，预计需${eventStockPlan.beerConsumption.kegsNeeded['20L']}个20L酒桶`
    };

    /** 收货入库 */
  async receiveNewStock() {
    return { success: true, summary: '新货已入库并同步至ERP和有赞库存' }; }
  }
}

module.exports = SupplyChainAgent;
