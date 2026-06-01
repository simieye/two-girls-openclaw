/**
 * OpenClaw 编排器
 * 中央调度核心 - 负责智能体注册、任务编排、消息路由、定时任务调度
 * 
 * 对应 OpenClaw 的 Leader-Worker 架构模式
 * Orchestrator (Claude Opus 4.5) → 7大模块智能体
 */

const { eventBus, EventTypes } = require('./event-bus');
const { logger, createAgentLogger } = require('../utils/logger');
const config = require('../config');

class Orchestrator {
  constructor() {
    this.logger = createAgentLogger('🎯 Orchestrator');
    this.agents = new Map();       // 所有注册的智能体
    this.modules = new Map();      // 按模块分组
    this.taskQueue = [];           // 任务队列
    this.isProcessing = false;     // 是否正在处理任务
    this.healthHistory = new Map(); // 健康历史
    
    // 智能体状态映射
    this.agentStatusMap = {
      'supply-chain-agent': 'pending',
      'inventory-agent': 'pending',
      'store-operation-agent': 'pending',
      'marketing-crm-agent': 'pending',
      'finance-agent': 'pending',
      'hr-agent': 'pending',
      'expansion-agent': 'pending',
    };
  }

  /**
   * 注册智能体
   */
  registerAgent(agent) {
    this.agents.set(agent.id, agent);
    
    // 按模块分组
    if (!this.modules.has(agent.module)) {
      this.modules.set(agent.module, []);
    }
    this.modules.get(agent.module).push(agent);
    
    this.agentStatusMap[agent.id] = 'active';
    
    this.logger.info(`📋 Agent registered: ${agent.name} (${agent.id}) [${agent.module}]`);
    
    // 监听健康事件
    eventBus.subscribe('Orchestrator', EventTypes.SYSTEM_AGENT_HEALTH, (event) => {
      this.updateAgentHealth(event.data);
    });
    
    // 监听错误事件
    eventBus.subscribe('Orchestrator', EventTypes.SYSTEM_ERROR, (event) => {
      this.handleAgentError(event.data);
    });
  }

  /**
   * 更新智能体健康状态
   */
  updateAgentHealth(healthData) {
    this.healthHistory.set(healthData.agentId, {
      ...healthData,
      updatedAt: new Date().toISOString(),
    });
    this.agentStatusMap[healthData.agentId] = healthData.status;
  }

  /**
   * 处理智能体错误
   */
  handleAgentError(errorData) {
    this.logger.warn(`⚠️ Agent error: ${errorData.agentName}`, { 
      error: errorData.error,
      context: errorData.context,
    });
    
    // 自动恢复策略
    const agent = this.agents.get(errorData.agentId);
    if (agent && agent.status === 'active') {
      agent.status = 'degraded';
      this.agentStatusMap[errorData.agentId] = 'degraded';
      
      // 30秒后尝试恢复
      setTimeout(async () => {
        try {
          await agent.start();
          this.logger.info(`🔄 Agent recovered: ${errorData.agentName}`);
        } catch (err) {
          this.logger.error(`❌ Agent recovery failed: ${errorData.agentName}`);
        }
      }, 30000);
    }
  }

  /**
   * 编排任务 - 根据任务类型分发到对应智能体
   */
  async orchestrateTask(task) {
    const { type, data, priority = 5 } = task;
    
    this.taskQueue.push({ type, data, priority, timestamp: new Date() });
    this.logger.debug(`📥 Task queued: ${type} (priority: ${priority})`);
    
    // 按优先级排序
    this.taskQueue.sort((a, b) => b.priority - a.priority);
    
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  /**
   * 处理任务队列
   */
  async processQueue() {
    this.isProcessing = true;
    
    while (this.taskQueue.length > 0) {
      const task = this.taskQueue.shift();
      const agent = this.routeTask(task);
      
      if (!agent) {
        this.logger.warn(`⚠️ No agent found for task: ${task.type}`);
        continue;
      }
      
      try {
        this.logger.info(`📤 Dispatching task to ${agent.name}: ${task.type}`);
        const result = await this.dispatchToAgent(agent, task);
        this.logger.info(`✅ Task completed by ${agent.name}: ${task.type}`);
      } catch (err) {
        this.logger.error(`❌ Task failed: ${task.type}`, { 
          agent: agent.name, 
          error: err.message 
        });
      }
    }
    
    this.isProcessing = false;
  }

  /**
   * 任务路由 - 根据任务类型匹配智能体
   */
  routeTask(task) {
    const routingTable = {
      // 供应链类
      'supply.stock.check': 'supply-chain-agent',
      'supply.order.create': 'supply-chain-agent',
      'supply.vendor.compare': 'supply-chain-agent',
      'supply.material.monitor': 'supply-chain-agent',
      
      // 库存类
      'inventory.sync': 'inventory-agent',
      'inventory.replenish': 'inventory-agent',
      'inventory.visualize': 'inventory-agent',
      'inventory.retail.check': 'inventory-agent',
      
      // 门店运营类
      'store.patrol': 'store-operation-agent',
      'store.sale.assist': 'store-operation-agent',
      'store.unattended': 'store-operation-agent',
      'store.device.health': 'store-operation-agent',
      
      // 营销CRM类
      'marketing.push': 'marketing-crm-agent',
      'marketing.campaign': 'marketing-crm-agent',
      'marketing.member': 'marketing-crm-agent',
      
      // 财务类
      'finance.reconcile': 'finance-agent',
      'finance.report': 'finance-agent',
      'finance.decision': 'finance-agent',
      
      // HR类
      'hr.schedule': 'hr-agent',
      'hr.service': 'hr-agent',
      
      // 扩张类
      'expansion.copy': 'expansion-agent',
      'expansion.unmanned': 'expansion-agent',
    };
    
    const agentId = routingTable[task.type];
    return agentId ? this.agents.get(agentId) : null;
  }

  /**
   * 向智能体分发任务
   */
  async dispatchToAgent(agent, task) {
    if (typeof agent.handleTask === 'function') {
      return agent.handleTask(task);
    }
    // 如果智能体没有 handleTask，发送事件
    return eventBus.request(agent.id, task.type, task.data);
  }

  /**
   * 批量并行执行任务
   */
  async orchestrateParallel(tasks) {
    this.logger.info(`🔄 Orchestrating ${tasks.length} tasks in parallel`);
    
    const results = await Promise.allSettled(
      tasks.map(task => this.orchestrateTask(task))
    );
    
    const summary = {
      total: tasks.length,
      succeeded: results.filter(r => r.status === 'fulfilled').length,
      failed: results.filter(r => r.status === 'rejected').length,
    };
    
    this.logger.info(`📊 Parallel execution completed`, summary);
    return { results, summary };
  }

  /**
   * 获取所有智能体状态
   */
  getAllAgentStatus() {
    const statuses = {};
    for (const [id, agent] of this.agents) {
      statuses[id] = agent.getStatus();
    }
    return statuses;
  }

  /**
   * 获取模块健康状态
   */
  getModuleHealth() {
    const health = {};
    for (const [module, agents] of this.modules) {
      const activeAgents = agents.filter(a => a.status === 'active').length;
      health[module] = {
        total: agents.length,
        active: activeAgents,
        status: activeAgents === agents.length ? 'healthy' : 
                activeAgents > 0 ? 'degraded' : 'error',
      };
    }
    return health;
  }

  /**
   * 启动所有智能体
   */
  async startAll() {
    this.logger.info('🚀 Starting all agents...');
    
    const startOrder = [
      'supply-chain-agent',
      'inventory-agent',
      'store-operation-agent',
      'marketing-crm-agent',
      'finance-agent',
      'hr-agent',
      'expansion-agent',
    ];
    
    for (const agentId of startOrder) {
      const agent = this.agents.get(agentId);
      if (agent) {
        try {
          await agent.start();
          this.logger.info(`✅ ${agent.name} started`);
        } catch (err) {
          this.logger.error(`❌ Failed to start ${agent.name}`, { error: err.message });
        }
      }
    }
    
    this.logger.info('🎉 All agents started');
  }

  /**
   * 停止所有智能体
   */
  async stopAll() {
    this.logger.info('🛑 Stopping all agents...');
    
    for (const [id, agent] of this.agents) {
      try {
        await agent.stop();
        this.logger.info(`✅ ${agent.name} stopped`);
      } catch (err) {
        this.logger.error(`❌ Failed to stop ${agent.name}`);
      }
    }
  }

  /**
   * 获取调度仪表盘数据
   */
  getDashboard() {
    return {
      timestamp: new Date().toISOString(),
      agents: this.getAllAgentStatus(),
      modules: this.getModuleHealth(),
      queueLength: this.taskQueue.length,
      totalAgents: this.agents.size,
      activeAgents: Array.from(this.agents.values()).filter(a => a.status === 'active').length,
    };
  }
}

// 单例
const orchestrator = new Orchestrator();

module.exports = { orchestrator, Orchestrator };
