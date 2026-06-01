/**
 * 智能体基类
 * 所有智能体继承此基类，获得事件总线、定时任务、日志等能力
 */

const { EventEmitter } = require('eventemitter3');
const { eventBus, EventTypes } = require('./event-bus');
const { createAgentLogger } = require('../utils/logger');
const config = require('../config');

class AgentBase extends EventEmitter {
  constructor(agentConfig) {
    super();
    
    this.id = agentConfig.id;
    this.name = agentConfig.name;
    this.module = agentConfig.module;
    this.description = agentConfig.description;
    this.status = agentConfig.status || 'pending'; // pending | active | degraded | error
    this.priority = agentConfig.priority || 5;
    this.model = agentConfig.model || config.openclaw.modelDefault;
    
    // 定时任务配置
    this.cronJobs = new Map();
    this.cronExpression = agentConfig.cron || null;
    
    // 订阅的事件类型
    this.subscribedEvents = agentConfig.subscribedEvents || [];
    
    // 状态
    this.uptime = null;
    this.startTime = null;
    this.taskCount = 0;
    this.errorCount = 0;
    this.lastRunAt = null;
    
    // Logger
    this.logger = createAgentLogger(this.name);
    
    // 数据缓存
    this.cache = new Map();
    this.cacheTTL = agentConfig.cacheTTL || 300000; // 默认5分钟
  }

  /**
   * 启动智能体
   */
  async start() {
    this.status = 'active';
    this.startTime = new Date();
    this.uptime = 0;
    
    // 注册到事件总线
    this.subscribedEvents.forEach(eventType => {
      eventBus.subscribe(this.name, eventType, this.handleEvent.bind(this));
    });
    
    // 发布注册事件
    eventBus.publish(EventTypes.SYSTEM_AGENT_REGISTERED, {
      agentId: this.id,
      agentName: this.name,
      module: this.module,
      status: this.status,
    });
    
    this.logger.info(`🚀 Agent started: ${this.name} [${this.module}]`);
    
    // 启动健康检查定时器
    this.healthCheckInterval = setInterval(() => {
      this.sendHeartbeat();
    }, 30000);
    
    // 子类可覆盖的初始化
    await this.onStart();
  }

  /**
   * 停止智能体
   */
  async stop() {
    this.status = 'pending';
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    this.logger.info(`🛑 Agent stopped: ${this.name}`);
    await this.onStop();
  }

  /**
   * 发送心跳
   */
  sendHeartbeat() {
    this.uptime = Date.now() - this.startTime;
    eventBus.publish(EventTypes.SYSTEM_AGENT_HEALTH, {
      agentId: this.id,
      agentName: this.name,
      status: this.status,
      uptime: this.uptime,
      taskCount: this.taskCount,
      errorCount: this.errorCount,
      lastRunAt: this.lastRunAt,
    });
  }

  /**
   * 处理事件 (子类覆盖)
   */
  async handleEvent(event) {
    this.logger.debug(`Event received: ${event.type}`, { eventId: event.id });
  }

  /**
   * 执行定时任务
   */
  async executeCronJob() {
    this.taskCount++;
    this.lastRunAt = new Date();
    this.logger.info(`⏰ Cron job executing: ${this.name}`);
    
    try {
      const result = await this.onCronExecute();
      this.logger.info(`✅ Cron job completed: ${this.name}`, { result });
      return result;
    } catch (err) {
      this.errorCount++;
      this.logger.error(`❌ Cron job failed: ${this.name}`, { error: err.message });
      eventBus.publish(EventTypes.SYSTEM_ERROR, {
        agentId: this.id,
        agentName: this.name,
        error: err.message,
        context: 'cron_execute',
      });
      throw err;
    }
  }

  /**
   * 子类覆盖 - 定时任务执行逻辑
   */
  async onCronExecute() {
    // 子类实现
  }

  /**
   * 子类覆盖 - 启动时初始化
   */
  async onStart() {
    // 子类实现
  }

  /**
   * 子类覆盖 - 停止时清理
   */
  async onStop() {
    // 子类实现
  }

  /**
   * 向其他智能体发送请求
   */
  requestAgent(targetAgent, action, payload) {
    return eventBus.request(targetAgent, action, payload);
  }

  /**
   * 广播消息
   */
  broadcast(eventType, data) {
    return eventBus.broadcast(eventType, data);
  }

  /**
   * 带缓存的数据获取
   */
  async getCached(key, fetcher, ttl = this.cacheTTL) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.data;
    }
    const data = await fetcher();
    this.cache.set(key, { data, timestamp: Date.now() });
    return data;
  }

  /**
   * 清除缓存
   */
  clearCache(key = null) {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }

  /**
   * 获取智能体状态
   */
  getStatus() {
    return {
      id: this.id,
      name: this.name,
      module: this.module,
      status: this.status,
      uptime: this.uptime,
      taskCount: this.taskCount,
      errorCount: this.errorCount,
      lastRunAt: this.lastRunAt,
      startTime: this.startTime,
      model: this.model,
    };
  }
}

module.exports = AgentBase;
