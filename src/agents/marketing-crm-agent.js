/**
 * 模块04: 营销与CRM智能体
 * 
 * 包含三个子智能体:
 * 1. 个性化推送体 - 基于消费历史推荐对口精酿
 * 2. 活动自主策划体 - 解析历史数据，生成节日/新品营销方案
 * 3. 会员智能管理体 - 积分核算、等级升级、流失预警
 */

const AgentBase = require('../core/agent-base');
const { youzanClient } = require('../integrations');
const { EventTypes } = require('../core/event-bus');
const config = require('../config');

// ==========================================
// 个性化推送体
// ==========================================
class PersonalizedPushAgent extends AgentBase {
  constructor() {
    super({
      id: 'marketing-crm-agent',
      name: '📲 个性化推送体',
      module: 'marketing-crm',
      description: '基于消费历史和口味画像推荐对口精酿',
      status: 'active',
      priority: 7,
      subscribedEvents: [
        EventTypes.STORE_SALE_COMPLETED,
        EventTypes.MEMBER_LEVEL_CHANGED,
      ],
      cron: config.cron.marketingReport,
    });
    
    this.pushTemplates = {
      newArrival: '🍺 {beerName} 新酒到店！{description}，来{storeName}尝尝？',
      birthday: '🎂 {customerName}生日快乐！到店消费享8折精酿优惠',
      revisit: '👋 好久不见！{beerName}想你了，本周来店享9折',
      levelUp: '🎉 恭喜升级{newLevel}会员！专属精酿品鉴特权已解锁',
      seasonal: '🌸 春季限定 {beerName} 已上线，限量供应',
    };
  }

  async onCronExecute() {
    return this.generatePushCampaign();
  }

  async generatePushCampaign() {
    this.logger.info('📲 生成个性化推送...');
    
    const members = await this.youzanClient.getMemberList({ pageSize: 100 });
    const pushes = [];
    
    for (const member of (members.customers || []).slice(0, 20)) {
      const push = await this.createPersonalizedPush(member);
      if (push) pushes.push(push);
    }
    
    this.broadcast(EventTypes.MARKETING_PUSH_SENT, {
      totalSent: pushes.length,
      timestamp: new Date().toISOString(),
    });
    
    this.logger.info(`✅ 推送完成: ${pushes.length}条`);
    return pushes;
  }

  async createPersonalizedPush(member) {
    const profile = await this.youzanClient.getMemberDetail(member.yz_open_id);
    
    // 流失预警客户
    const lastPurchase = profile.last_purchase_time;
    const daysSinceLastPurchase = lastPurchase 
      ? (Date.now() - new Date(lastPurchase).getTime()) / 86400000 
      : 999;
    
    if (daysSinceLastPurchase > 30) {
      return {
        type: 'revisit',
        customerId: member.yz_open_id,
        message: this.pushTemplates.revisit
          .replace('{beerName}', 'IPA精酿'),
        priority: 'high',
      };
    }
    
    // 高价值客户 - 新酒推荐
    if (profile.total_purchase_amount > 5000) {
      return {
        type: 'newArrival',
        customerId: member.yz_open_id,
        message: this.pushTemplates.newArrival
          .replace('{beerName}', '双倍IPA')
          .replace('{description}', '浓郁酒花香，苦度70IBU')
          .replace('{storeName}', '精酿工坊'),
        priority: 'medium',
      };
    }
    
    return null;
  }
}

// ==========================================
// 活动自主策划体
// ==========================================
class CampaignAutoPlannerAgent extends AgentBase {
  constructor() {
    super({
      id: 'campaign-planner-agent',
      name: '🎯 活动自主策划体',
      module: 'marketing-crm',
      description: '解析历史数据，自主生成节日/新品营销方案',
      status: 'grayscale',
      priority: 6,
      subscribedEvents: [
        EventTypes.MARKETING_CAMPAIGN_CREATED,
      ],
    });
    
    this.festivalCalendar = {
      'spring_festival': { name: '春节', month: 1, theme: '精酿迎新春' },
      'valentine': { name: '情人节', month: 2, theme: '精酿配浪漫' },
      'women_day': { name: '女神节', month: 3, theme: '果味精酿派对' },
      'labor_day': { name: '劳动节', month: 5, theme: '致敬劳动者畅饮' },
      'dragon_boat': { name: '端午节', month: 6, theme: '精酿配粽' },
      'mid_autumn': { name: '中秋节', month: 9, theme: '精酿赏月' },
      'national_day': { name: '国庆节', month: 10, theme: '精酿狂欢周' },
      'christmas': { name: '圣诞节', month: 12, theme: '圣诞精酿市集' },
    };
  }

  async planCampaign(festival) {
    const festivalInfo = this.festivalCalendar[festival];
    if (!festivalInfo) {
      this.logger.warn(`未知节日: ${festival}`);
      return null;
    }
    
    this.logger.info(`🎯 策划 ${festivalInfo.name} 活动...`);
    
    // 分析历史销售数据
    const lastYearData = await this.youzanClient.getOrderStats(
      new Date(Date.now() - 365 * 86400000).toISOString(),
      new Date().toISOString()
    );
    
    const campaign = {
      festival: festivalInfo.name,
      theme: festivalInfo.theme,
      duration: '7天',
      channels: ['有赞微商城', '门店小程序', '社群'],
      tactics: [
        { type: 'discount', name: '第二杯半价', target: '新客拉新' },
        { type: 'coupon', name: '满200减30', target: '老客复购' },
        { type: 'bundle', name: '精酿品鉴套餐', target: '客单价提升' },
        { type: 'member', name: '双倍积分', target: '会员激活' },
      ],
      expectedROI: 3.5,
      budget: 5000,
      generatedAt: new Date().toISOString(),
    };
    
    this.broadcast(EventTypes.MARKETING_CAMPAIGN_CREATED, campaign);
    this.logger.info(`✅ 活动方案已生成: ${campaign.theme}`);
    
    return campaign;
  }
}

// ==========================================
// 会员智能管理体
// ==========================================
class MemberManagementAgent extends AgentBase {
  constructor() {
    super({
      id: 'member-manage-agent',
      name: '👤 会员智能管理体',
      module: 'marketing-crm',
      description: '积分核算、等级升级、流失预警',
      status: 'active',
      priority: 8,
      subscribedEvents: [
        EventTypes.STORE_SALE_COMPLETED,
        EventTypes.MARKETING_PUSH_SENT,
      ],
    });
    
    this.churnThreshold = 60; // 60天未消费 = 流失风险
  }

  async handleEvent(event) {
    if (event.type === EventTypes.STORE_SALE_COMPLETED) {
      await this.processSaleForMember(event.data);
    }
  }

  async processSaleForMember(saleData) {
    this.logger.debug('处理会员消费...', { tradeId: saleData.tradeId });
    // 积分核算、等级判断
  }

  async checkChurnRisk() {
    this.logger.info('🔍 检查会员流失风险...');
    
    const members = await this.youzanClient.getMemberList({ pageSize: 200 });
    const atRisk = [];
    
    for (const member of (members.customers || [])) {
      const detail = await this.youzanClient.getMemberDetail(member.yz_open_id);
      const daysSinceLastPurchase = detail.last_purchase_time
        ? Math.floor((Date.now() - new Date(detail.last_purchase_time).getTime()) / 86400000)
        : 999;
      
      if (daysSinceLastPurchase > this.churnThreshold) {
        atRisk.push({
          customerId: member.yz_open_id,
          daysInactive: daysSinceLastPurchase,
          totalSpent: detail.total_purchase_amount,
          risk: daysSinceLastPurchase > 90 ? 'high' : 'medium',
        });
      }
    }
    
    if (atRisk.length > 0) {
      this.broadcast(EventTypes.MEMBER_CHURN_RISK, {
        atRiskMembers: atRisk,
        totalAtRisk: atRisk.length,
        timestamp: new Date().toISOString(),
      });
    }
    
    this.logger.info(`📊 流失风险: ${atRisk.length}人`);
    return atRisk;
  }

  async autoLevelUp() {
    this.logger.info('🔄 自动会员升级...');
    // 检查并自动升级满足条件的会员
  }
}

module.exports = {
  PersonalizedPushAgent,
  CampaignAutoPlannerAgent,
  MemberManagementAgent,
};
