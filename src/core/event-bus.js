/**
 * 事件总线 - 跨智能体消息通信
 * 所有智能体通过事件总线进行数据交换和消息传递
 */

const EventEmitter = require('eventemitter3');
const { logger } = require('../utils/logger');

class EventBus extends EventEmitter {
  constructor() {
    super();
    this.eventHistory = [];
    this.maxHistory = 10000;
    this.subscriptions = new Map();
  }

  /**
   * 发布事件
   */
  publish(eventType, data) {
    const event = {
      id: require('uuid').v4(),
      type: eventType,
      data,
      timestamp: new Date().toISOString(),
    };
    
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistory) {
      this.eventHistory.shift();
    }

    this.emit(eventType, event);
    logger.debug(`📡 Event published: ${eventType}`, { eventId: event.id });
    return event;
  }

  /**
   * 订阅事件
   */
  subscribe(agentName, eventType, handler) {
    const key = `${agentName}:${eventType}`;
    if (!this.subscriptions.has(key)) {
      this.subscriptions.set(key, []);
    }
    this.subscriptions.get(key).push(handler);
    this.on(eventType, handler);
    logger.debug(`📥 ${agentName} subscribed to ${eventType}`);
  }

  /**
   * 获取事件历史
   */
  getHistory(eventType = null, limit = 100) {
    let events = this.eventHistory;
    if (eventType) {
      events = events.filter(e => e.type === eventType);
    }
    return events.slice(-limit);
  }

  /**
   * 智能体间请求-响应模式
   */
  request(targetAgent, action, payload) {
    const requestId = require('uuid').v4();
    const requestEvent = {
      id: requestId,
      type: `agent.request`,
      data: {
        from: 'event-bus',
        to: targetAgent,
        action,
        payload,
        requestId,
      },
      timestamp: new Date().toISOString(),
    };

    this.emit(`agent.${targetAgent}.request`, requestEvent);
    logger.debug(`📤 Request sent to ${targetAgent}: ${action}`, { requestId });
    return requestId;
  }

  /**
   * 广播到所有智能体
   */
  broadcast(eventType, data) {
    const event = this.publish(eventType, data);
    logger.info(`📢 Broadcast: ${eventType}`, { eventId: event.id });
    return event;
  }
}

// 单例模式
const eventBus = new EventBus();

// ==========================================
// 预定义事件类型
// ==========================================
const EventTypes = {
  // 供应链
  SUPPLY_STOCK_LOW: 'supply.stock.low',
  SUPPLY_ORDER_CREATED: 'supply.order.created',
  SUPPLY_ORDER_CONFIRMED: 'supply.order.confirmed',
  SUPPLY_VENDOR_COMPARED: 'supply.vendor.compared',

  // 库存
  INVENTORY_UPDATED: 'inventory.updated',
  INVENTORY_REPLENISH_NEEDED: 'inventory.replenish.needed',
  INVENTORY_REPLENISH_DONE: 'inventory.replenish.done',

  // 门店运营
  STORE_SALE_COMPLETED: 'store.sale.completed',
  STORE_PATROL_ALERT: 'store.patrol.alert',
  STORE_DEVICE_ALERT: 'store.device.alert',
  STORE_UNATTENDED_EVENT: 'store.unattended.event',

  // 营销CRM
  MARKETING_CAMPAIGN_CREATED: 'marketing.campaign.created',
  MARKETING_PUSH_SENT: 'marketing.push.sent',
  MEMBER_LEVEL_CHANGED: 'member.level.changed',
  MEMBER_CHURN_RISK: 'member.churn.risk',

  // 财务
  FINANCE_RECONCILE_DONE: 'finance.reconcile.done',
  FINANCE_REPORT_GENERATED: 'finance.report.generated',
  FINANCE_ANOMALY_DETECTED: 'finance.anomaly.detected',

  // HR
  HR_SCHEDULE_PUBLISHED: 'hr.schedule.published',
  HR_ATTENDANCE_ALERT: 'hr.attendance.alert',

  // ERP同步
  ERP_DATA_SYNCED: 'erp.data.synced',
  ERP_SUPPLY_CHAIN_UPDATED: 'erp.supplychain.updated',

  // 系统
  SYSTEM_HEARTBEAT: 'system.heartbeat',
  SYSTEM_AGENT_REGISTERED: 'system.agent.registered',
  SYSTEM_AGENT_HEALTH: 'system.agent.health',
  SYSTEM_ERROR: 'system.error',
};

module.exports = { eventBus, EventTypes };
