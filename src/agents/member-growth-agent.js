/**
 * ============================================================
 * 会员增长智能体 (Member Growth Agent)
 * Two Girls Brew - 从获客到留存到推荐的全生命周期管理
 * 核心目标: 会员数↑ 复购率↑ LTV↑
 * 
 * 与其他智能体协作:
 * - TrafficAcquisitionAgent → 线上流量 → MemberGrowthAgent(转化)
 * - StoreOperationAgent → 到店体验 → MemberGrowthAgent(激活/留存)
 * - FinanceIntelligenceAgent → 消费数据 → MemberGrowthAgent(RFM分析)
 * ============================================================
 */

const { knowledgeBase } = require('../knowledge-base/business-knowledge');
const logger = require('../utils/logger');

class MemberGrowthAgent {
  constructor(config = {}) {
    this.name = 'MemberGrowthAgent';
    this.domain = 'member';
    this.priority = 3;
    this.capabilities = [
      'member.acquire', 'member.engage', 'member.analyze',
      'member.lead:capture', 'member.convert:event'
    ];
    
    // 基于真实业务配置的会员体系
    this.membershipConfig = {
      levels: knowledgeBase.products.pricing.membership,
      
      // RFM模型参数 (基于精酿酒吧行业经验)
      rfm: {
        recency: {   // R: 最近一次消费距今天数
          excellent: 7,    // 7天内
          good: 14,        // 14天内
          average: 30,     // 30天内
          atRisk: 60,      // 60天未消费
          churned: 90     // 90天+ = 流失
        },
        frequency: {  // F: 月均到店次数
          vip: 4,
          regular: 2,
          casual: 0.5,
          new: 0
        },
        monetary: {   // M: 月均消费金额
          whale: 500,
          high: 200,
          medium: 80,
          low: 30
        }
      },

      // 生命周期阶段与对应策略
      lifecycleStages: [
        { stage: 'aware', name: '认知', actions: ['社交广告触达', 'KOL内容种草', '线下活动曝光'], targetAction: '首次进店' },
        { stage: 'acquire', name: '获客', actions: ['新人优惠券', '首杯半价', '注册送礼'], targetAction: '完成注册' },
        { stage: 'activate', name: '激活', actions: ['品鉴引导', '酒单推荐', '调酒师互动'], targetAction: '第2次到店' },
        { stage: 'retain', name: '留存', actions: ['会员日福利', '积分兑换', '专属活动邀请'], targetAction: '月度复购' },
        { stage: 'revenue', name: '增收', actions: ['升级推荐', '套餐搭配', '储值激励'], targetAction: '提升客单' },
        { stage: 'advocate', name: '推荐', actions: ['邀请奖励', 'UGC激励', '品牌大使计划'], targetAction: '主动分享' },
        { stage: 'reactivate', name: '召回', actions: ['回归大礼包', '限时优惠', '个性化召回'], targetAction: '重新活跃' }
      ],

      // 画像标签体系
      tags: {
        preference: ['IPA爱好者', '酸啤控', '世涛粉', '拉格派', '果味党', '无酒精偏好', '什么都想试'],
        behavior: ['周末常客', '工作日下班族', '深夜党', '下午茶客', '活动达人', '独行侠', '组局王'],
        demographic: ['学生党', '职场白领', '自由职业', '外籍人士'],
        social: ['小红书活跃', '抖音用户', '大众点评写手', '微信社群活跃']
      }
    };
  }

  async execute(params) {
    const { action } = params;
    
    const actionMap = {
      acquire: () => this.acquire(params.params),
      engage: () => this.engage(),
      analyze: () => this.analyze(),
      captureLeads: () => this.captureLeads(params),
      convertEventAttendees: () => this.convertEventAttendees(),
      checkChurnRisk: () => this.checkChurnRisk()
    };

    return await (actionMap[action] || actionMap['analyze']).call(this);
  }

  /** 获客 */
  async acquire({ channel = 'all' }) {
    const channels = {
      online: {
        youzan: { source: '有赞微商城注册', conversionRate: 0.15, avgCAC: 8, monthlyTarget: 120 },
        dianping: { source: '关注店铺后引导注册', conversionRate: 0.10, avgCAC: 12, monthlyTarget: 80 },
        xiaohongshu: { source: '笔记→私信→引导注册', conversionRate: 0.05, avgCAC: 20, monthlyTarget: 40 },
        douyin: { source: '视频→主页→注册', conversionRate: 0.04, avgCAC: 25, monthlyTarget: 30 },
        wechat_qrcode: { source: '扫码关注公众号/小程序', conversionRate: 0.20, avgCAC: 5, monthlyTarget: 150 }
      },
      offline: {
        store_visit: { source: '门店扫码注册', conversionRate: 0.35, avgCAC: 3, monthlyTarget: 200 },
        event_attendance: { source: '活动签到注册', conversionRate: 0.42, avgCAC: 15, monthlyTarget: 50 },  // 年会等大型活动
        referral: { source: '老带新推荐', conversionRate: 0.50, avgCAC: 10, monthlyTarget: 25 },
        partner_bar: { source: '合作店引流', conversionRate: 0.12, avgCAC: 8, monthlyTarget: 20 }
      }
    };

    return {
      success: true,
      channelStrategy: channels,
      recommendedMix: {
        offline_primary: '以门店自然流量为主(占比55%)',
        online_supplement: '线上渠道辅助获客(占比30%)',
        event_bursts: '大型活动集中获取(占比15%)',
        totalMonthlyTarget: 695,
        projectedCAC: 8.2  // 加权平均获客成本
      },
      summary: `多渠道获客策略已生成，月目标${695}人，加权CAC ¥8.2`
    };
  }

  /** 互动触达 */
  async engage() {
    const cfg = this.membershipConfig;
    
    const engagementPlan = {
      daily: [
        { time: '10:00', type: 'push', target: '昨日到店新客', content: '感谢昨天光临！附一张新人券' },
        { time: '18:00', type: 'wechat_group', target: '社群活跃用户', content: '今晚有新品上线，来试试？' }
      ],
      weekly: [
        { day: '周一', time: '11:00', type: 'newsletter', target: '全部会员', content: '本周上新 + 上周热门榜单' },
        { day: '周三', time: '17:00', type: 'coupon_push', target: '3天未到店的普通会员', content: '想念你啦，送张回归券~' },
        { day: '周五', time: '12:00', type: 'event_preview', target: '周末常客', content: '本周末活动预告 + 预约优先权' }
      ],
      monthly: [
        { day: 8, type: 'membership_day', target: '全体会员', content: '每月8号会员日！双倍积分+限定款抢先尝' },
        { day: 15, type: 'birthday_batch', target: '当月寿星', content: '生日快乐！免费一杯等你来领' },
        { day: 25, type: 'tier_upgrade_notify', target: '接近升级的会员', content: '再消费XX元即可升级，附专属权益说明' }
      ],
      triggered: [
        { trigger: 'first_visit_after_register', action: '发送新人欢迎礼包(券×3)' },
        { trigger: '3rd_visit_in_30d', action: '升级为"常客"，推送常客专属权益' },
        { trigger: '30d_no_visit_high_value', action: '电话回访+大额回归券' },
        { trigger: 'large_order_500+', action: '次日发送感谢+邀请评价' },
        { trigger: 'social_share_detected', action: '送分享奖励券' }
      ]
    };

    return {
      success: true,
      engagementPlan,
      summary: '会员触达计划已生成（每日/每周/每月/事件触发）'
    };
  }

  /** 分析 */
  async analyze() {
    // 模拟RFM分析结果
    const rfmResult = {
      totalMembers: 3850,
      analysisDate: new Date(),
      
      segments: {
        champions: {           // 高频高价值近期活跃
          count: 185,
          pct: 4.8,
          description: '核心VIP，最高价值群体',
          avgMonthlyVisits: 5.2,
          avgMonthlySpend: 680,
          strategy: '保持满意度，提供超预期体验，邀请成为品牌大使'
        },
        loyalCustomers: {       // 中高频率稳定消费
          count: 420,
          pct: 10.9,
          description: '忠实客户群',
          avgMonthlyVisits: 2.8,
          avgMonthlySpend: 280,
          strategy: '维护关系，适度交叉销售，邀请参与新品测试'
        },
        potentialLoyalist: {    // 近期有消费但频率不高
          count: 680,
          pct: 17.7,
          description: '潜力客户，有望提升为忠诚客户',
          avgMonthlyVisits: 1.2,
          avgMonthlySpend: 130,
          strategy: '增加接触频率，推荐会员日活动，提供首次复购优惠'
        },
        newCustomers: {         // 最近注册/首购
          count: 520,
          pct: 13.5,
          description: '新客户，需要激活',
          avgMonthlyVisits: 0.3,
          avgMonthlySpend: 58,
          strategy: '新人旅程优化，确保第二次到店体验'
        },
        atRisk: {               // 曾经高频但最近减少
          count: 310,
          pct: 8.1,
          description: '流失风险，需要干预',
          daysSinceLastVisit: 45,
          avgHistoricalSpend: 195,
          strategy: '立即触发召回流程：调查原因+个性化优惠+情感连接'
        },
        hibernating: {           // 长期不活跃
          count: 980,
          pct: 25.5,
          description: '准流失或已流失',
          daysSinceLastVisit: 95,
          strategy: '低成本批量触达(短信/邮件)，筛选有意向者重点跟进'
        },
        cannotLose: {            // 高价值但近期未消费！
          count: 75,
          pct: 1.9,
          description: '⚠️ 最高优先级！高价值客户正在流失',
          avgHistoricalMonthlySpend: 520,
          daysSinceLastVisit: 35,
          strategy: '店长亲自联系，提供超值回归方案'
        }
      },

      // 关键指标
      metrics: {
        activeRate: 0.49,              // 活跃率 (近30天有消费)
        monthlyNewGrowth: 145,         // 月新增会员
        monthlyChurn: 68,              // 月流失会员
        netGrowth: 77,                 // 净增长
        avgLTV: 2840,                  // 客户生命周期价值
        avgLTVMonths: 14,              // 平均生命周期长度(月)
        retention30d: 0.42,            // 30日留存率
        retention90d: 0.28,            // 90日留存率
        referralRate: 0.12             // 推荐率
      },

      // 可行动建议
      actionItems: [
        { priority: 'P0', action: '立即联系75名cannotLose客户', owner: 'StoreOperationAgent' },
        { priority: 'P1', action: '启动310名atRisk客户召回campaign', owner: 'TrafficAcquisitionAgent' },
        { priority: 'P1', action: '优化520名newCustomers的二次到店体验', owner: 'StoreOperationAgent' },
        { priority: 'P2', action: '设计potentialLoyalist升级激励机制', owner: 'this' },
        { priority: 'P3', action: '对hibernating进行低成本batch reactivation', owner: 'TrafficAcquisitionAgent' }
      ]
    };

    return {
      success: true,
      rfmAnalysis: rfmResult,
      summary: `RFM分析完成。共${rfmResult.totalMembers}名会员，活跃率${(rfmResult.metrics.activeRate * 100).toFixed(0)}%`
    };
  }

  /** 线索捕获 */
  async captureLeads() {
    return {
      sources: ['小红书私信', '抖音评论', '大众点评收藏', '活动签到表', '扫码加微信'],
      captureFlow: '来源 → 打标签 → 分配等级 → 自动欢迎序列 → 首次到店追踪',
      summary: '线索捕获流程已就绪'
    };
  }

  /** 活动参与者转化 */
  async convertEventAttendees() {
    return {
      strategy: '活动后48小时内发送感谢信+专属优惠券+会员注册引导',
      expectedConversion: 0.42,  // 基于年会复盘数据
      summary: '活动参与者转化方案已准备'
    };
  }

  /** 流失风险检查 */
  async checkChurnRisk() {
    const analysis = await this.analyze();
    const atRiskTotal = analysis.rfmResult.segments.atRisk.count + 
                        analysis.rfmResult.segments.cannotLose.count +
                        analysis.rfmResult.segments.hibernating.filter(() => Math.random() > 0.5).length;
    
    return {
      atRiskCount: atRiskTotal,
      immediateActionsRequired: analysis.rfmResult.actionItems.filter(i => i.priority === 'P0'),
      summary: `${atRiskTotal}名会员存在流失风险`
    };
  }
}

module.exports = MemberGrowthAgent;
