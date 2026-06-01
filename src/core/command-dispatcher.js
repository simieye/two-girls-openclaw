/**
 * ============================================================
 * OpenClaw 统一指令调度引擎 (Command Dispatcher)
 * Two Girls Brew 智能体矩阵 v3.0
 * 
 * 核心功能:
 * 1. 解析自然语言/结构化指令 → 路由到对应智能体
 * 2. 管理智能体生命周期 (注册/启动/停止/通信)
 * 3. 执行链编排 (多智能体协作流水线)
 * 4. 结果聚合与业绩目标追踪
 * 5. 定时任务触发与事件驱动响应
 * ============================================================
 */

const EventEmitter = require('events');
const { knowledgeBase } = require('../knowledge-base/business-knowledge');
const logger = require('../utils/logger');

class CommandDispatcher extends EventEmitter {
  constructor(config = {}) {
    super();
    this.agents = new Map();           // 注册的智能体实例
    this.agentRegistry = new Map();    // 智能体能力映射表
    this.commandHistory = [];          // 指令执行历史
    this.executionQueue = [];          // 待执行队列
    this.isRunning = false;
    this.metrics = {
      totalCommands: 0,
      successCount: 0,
      failCount: 0,
      avgLatency: 0,
      agentStats: new Map()            // 各智能体调用统计
    };
    
    // KPI 目标引用
    this.kpiTargets = knowledgeBase.kpiTargets;
    
    // 配置
    this.config = {
      maxConcurrentAgents: config.maxConcurrentAgents || 10,
      commandTimeout: config.commandTimeout || 30000,   // 30s超时
      retryCount: config.retryCount || 3,
      enableMetrics: config.enableMetrics !== false,
      ...config
    };

    this._setupErrorHandling();
  }

  /**
   * 注册智能体到调度中心
   */
  registerAgent(agent) {
    if (!agent || !agent.name || !agent.execute) {
      throw new Error('Invalid agent: must have name and execute method');
    }

    const agentInfo = {
      instance: agent,
      name: agent.name,
      domain: agent.domain || 'general',
      capabilities: agent.capabilities || [],
      priority: agent.priority || 5,        // 1-10, 数字越小优先级越高
      status: 'idle',
      lastActive: null,
      stats: { calls: 0, errors: 0, avgTime: 0 }
    };

    this.agents.set(agent.name, agentInfo);
    
    // 建立能力→智能体的反向索引
    agent.capabilities.forEach(cap => {
      if (!this.agentRegistry.has(cap)) {
        this.agentRegistry.set(cap, []);
      }
      this.agentRegistry.get(cap).push(agent.name);
    });

    logger.info(`[Dispatcher] Agent registered: ${agent.name} (domain: ${agentInfo.domain}, capabilities: ${agent.capabilities.length})`);
    this.emit('agent:registered', { name: agent.name, domain: agentInfo.domain });
    return this;
  }

  /**
   * 核心指令解析与路由 - 支持多种输入格式
   */
  async dispatch(command, context = {}) {
    const startTime = Date.now();
    this.metrics.totalCommands++;
    
    try {
      // 1. 解析指令
      const parsedCmd = this._parseCommand(command);
      
      logger.info(`[Dispatcher] Command received: ${parsedCmd.raw}`, {
        type: parsedCmd.type,
        target: parsedCmd.targetAgent,
        action: parsedCmd.action
      });

      // 2. 记录指令历史
      const record = {
        id: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        raw: command,
        parsed: parsedCmd,
        timestamp: new Date(),
        status: 'pending',
        context
      };
      this.commandHistory.push(record);

      // 3. 路由到目标智能体(s)
      const result = await this._routeAndExecute(parsedCmd, context, record);
      
      record.status = 'completed';
      record.result = result;
      record.duration = Date.now() - startTime;

      // 4. 更新指标 & 触发KPI检查
      this._updateMetrics(parsedCmd.targetAgent, true, record.duration);
      this._checkKpiImpact(parsedCmd, result);

      logger.info(`[Dispatcher] Command completed in ${record.duration}ms`, { result: result.summary });
      this.emit('command:completed', record);
      
      return result;

    } catch (error) {
      this.metrics.failCount++;
      logger.error(`[Dispatcher] Command failed: ${error.message}`, { command });
      this.emit('command:error', { command, error: error.message });
      throw error;
    }
  }

  /**
   * 指令解析器 - 支持3种格式
   * 格式1: 结构化 "sales:report:daily" (OpenClaw标准)
   * 格式2: 自然语言 "查看今日销售报表"
   * 格式3: 对象式 { type:'sales', action:'report', params:{period:'daily'} }
   */
  _parseCommand(command) {
    // 已是对象
    if (typeof command === 'object' && command.type && command.action) {
      return {
        ...command,
        raw: JSON.stringify(command),
        format: 'object',
        targetAgent: this._resolveTargetAgent(command.type, command.action)
      };
    }

    // 字符串 → 尝试结构化格式
    if (typeof command === 'string') {
      // 格式1: domain:action:params
      if (command.includes(':')) {
        const parts = command.split(':');
        const [domain, action, ...params] = parts;
        
        return {
          raw: command,
          format: 'structured',
          type: domain,
          action: action,
          params: params.length > 0 ? params.join(':') : undefined,
          targetAgent: this._resolveTargetAgent(domain, action)
        };
      }

      // 格式2: 自然语言 → NLP路由
      return this._parseNaturalLanguage(command);
    }

    throw new Error(`Unsupported command format: ${typeof command}`);
  }

  /**
   * 自然语言指令解析 - 关键词匹配路由
   */
  _parseNaturalLanguage(text) {
    const lowerText = text.toLowerCase();
    
    // === 销售相关 ===
    if (/销售|营业额|GMV|营收|业绩|销量|订单|成交/.test(lowerText)) {
      if (/报告|报表|汇总|统计|数据|看板|dashboard/.test(lowerText)) {
        const period = /日|今天|当日|today/.test(lowerText) ? 'daily' :
                       /周|本周|week/.test(lowerText) ? 'weekly' :
                       /月|本月|month/.test(lowerText) ? 'monthly' : 'daily';
        return { raw: text, format: 'nlp', type: 'sales', action: 'report', params: { period }, targetAgent: 'SalesGrowthAgent' };
      }
      if (/预测|预估|forecast|目标/.test(lowerText)) {
        return { raw: text, format: 'nlp', type: 'sales', action: 'forecast', params: {}, targetAgent: 'SalesGrowthAgent' };
      }
      if (/设置|调整|设定.*目标/.test(lowerText)) {
        return { raw: text, format: 'nlp', type: 'sales', action: 'setTarget', params: { value: this._extractNumber(text) }, targetAgent: 'SalesGrowthAgent' };
      }
    }

    // === 营销相关 ===
    if (/营销|推广|活动|campaign|促销|优惠券|发券|种草|内容|文案|海报/.test(lowerText)) {
      if (/发起|创建|开始|launch|新建/.test(lowerText)) {
        const channel = /小红书|xhs/.test(lowerText) ? 'xiaohongshu' :
                        /抖音|douyin|直播/.test(lowerText) ? 'douyin' :
                        /点评|dianping/.test(lowerText) ? 'dianping' :
                        /有赞|微商城|小程序/.test(lowerText) ? 'youzan' : 'all';
        return { raw: text, format: 'nlp', type: 'marketing', action: 'launchCampaign', params: { channel }, targetAgent: 'TrafficAcquisitionAgent' };
      }
      if (/发券|优惠券|coupon|赠送/.test(lowerText)) {
        return { raw: text, format: 'nlp', type: 'marketing', action: 'distributeCoupon', params: {}, targetAgent: 'TrafficAcquisitionAgent' };
      }
      if (/生成|写|创作|generate/.test(lowerText)) {
        return { raw: text, format: 'nlp', type: 'marketing', action: 'generateContent', params: {}, targetAgent: 'TrafficAcquisitionAgent' };
      }
      if (/啤酒节|年会|快闪|市集|活动/.test(lowerText)) {
        return { raw: text, format: 'nlp', type: 'event', action: 'manageEvent', params: {}, targetAgent: 'EventExecutionAgent' };
      }
    }

    // === 门店运营 ===
    if (/门店|店铺|库存|酒单|龙头|tap|菜单|员工|排班|巡店|评价|review/.test(lowerText)) {
      if (/库存|stock|补货|缺货|盘点/.test(lowerText)) {
        return { raw: text, format: 'nlp', type: 'store', action: 'inventoryCheck', params: {}, targetAgent: 'StoreOperationAgent' };
      }
      if (/酒单|龙头|tap|换酒|上新|轮换/.test(lowerText)) {
        const tapId = this._extractNumber(text);
        return { raw: text, format: 'nlp', type: 'store', action: 'updateTapMenu', params: { tapId }, targetAgent: 'StoreOperationAgent' };
      }
      if (/排班|班次|staff|人员|上班/.test(lowerText)) {
        return { raw: text, format: 'nlp', type: 'store', action: 'manageSchedule', params: {}, targetAgent: 'StoreOperationAgent' };
      }
      if (/评价|review|评论|回复|差评/.test(lowerText)) {
        return { raw: text, format: 'nlp', type: 'store', action: 'handleReviews', params: {}, targetAgent: 'StoreOperationAgent' };
      }
    }

    // === 供应链 ===
    if (/采购|原料|麦芽|酒花|酵母|酿造|brew|生产|供货|供应商|物流|配送|冷链/.test(lowerText)) {
      if (/采购|下单|进货|purchase/.test(lowerText)) {
        return { raw: text, format: 'nlp', type: 'supply', action: 'createPurchase', params: {}, targetAgent: 'SupplyChainAgent' };
      }
      if (/酿造|生产|brew|批次|batch/.test(lowerText)) {
        return { raw: text, format: 'nlp', type: 'supply', action: 'monitorBrewing', params: {}, targetAgent: 'SupplyChainAgent' };
      }
      if (/物流|配送|delivery|运输/.test(lowerText)) {
        return { raw: text, format: 'nlp', type: 'supply', action: 'trackDelivery', params: {}, targetAgent: 'SupplyChainAgent' };
      }
    }

    // === 会员/CRM ===
    if (/会员|用户|客户|member|粉丝|关注|留存|复购|RFM| cohort/.test(lowerText)) {
      if (/拉新|获客|增长|新增/.test(lowerText)) {
        const channel = /线上|online|微信/.test(lowerText) ? 'online' : 'offline';
        return { raw: text, format: 'nlp', type: 'member', action: 'acquire', params: { channel }, targetAgent: 'MemberGrowthAgent' };
      }
      if (/分析|画像|分层|segment|RFM/.test(lowerText)) {
        return { raw: text, format: 'nlp', type: 'member', action: 'analyze', params: {}, targetAgent: 'MemberGrowthAgent' };
      }
      if (/触达|推送|消息|通知|短信|engage/.test(lowerText)) {
        return { raw: text, format: 'nlp', type: 'member', action: 'engage', params: {}, targetAgent: 'MemberGrowthAgent' };
      }
    }

    // === 财务 ===
    if (/财务|对账|发票|利润|成本|核算|revenue|profit|invoice|payment/.test(lowerText)) {
      return { raw: text, format: 'nlp', type: 'finance', action: 'report', params: {}, targetAgent: 'FinanceIntelligenceAgent' };
    }

    // 默认 → GeneralAgent
    return { raw: text, format: 'nlp', type: 'general', action: 'process', params: {}, targetAgent: 'GeneralAgent' };
  }

  /**
   * 根据类型+动作解析目标智能体
   */
  _resolveTargetAgent(type, action) {
    const routingTable = {
      sales: { '*': 'SalesGrowthAgent' },
      marketing: { '*': 'TrafficAcquisitionAgent' },
      event: { '*': 'EventExecutionAgent' },
      store: { '*': 'StoreOperationAgent' },
      supply: { '*': 'SupplyChainAgent' },
      member: { '*': 'MemberGrowthAgent' },
      finance: { '*': 'FinanceIntelligenceAgent' },
      hr: { '*': 'HRTalentAgent' },
      expansion: { '*': 'ExpansionAgent' },
      general: { '*': 'GeneralAgent' }
    };
    
    const domainRouting = routingTable[type];
    if (domainRouting) {
      return domainRouting[action] || domainRouting['*'];
    }
    
    // 通过能力注册表查找
    const capabilityKey = `${type}:${action}`;
    const matchedAgents = this.agentRegistry.get(capabilityKey);
    if (matchedAgents && matchedAgents.length > 0) {
      return matchedAgents[0];
    }
    
    return 'GeneralAgent';
  }

  /**
   * 路由并执行指令
   */
  async _routeAndExecute(parsedCmd, context, record) {
    const agentName = parsedCmd.targetAgent;
    const agentInfo = this.agents.get(agentName);

    if (!agentInfo) {
      // 尝试通过能力查找备选智能体
      const fallback = this._findFallbackAgent(parsedCmd.type, parsedCmd.action);
      if (fallback) {
        logger.warn(`[Dispatcher] Agent '${agentName}' not found, using fallback: ${fallback}`);
        return await this._executeAgent(fallback, parsedCmd, context);
      }
      throw new Error(`No agent available for command: ${parsedCmd.raw}`);
    }

    return await this._executeAgent(agentName, parsedCmd, context);
  }

  /**
   * 执行单个智能体
   */
  async _executeAgent(agentName, parsedCmd, context) {
    const agentInfo = this.agents.get(agentName);
    agentInfo.status = 'running';
    agentInfo.lastActive = new Date();

    try {
      const result = await Promise.race([
        agentInfo.instance.execute({
          action: parsedCmd.action,
          params: parsedCmd.params,
          type: parsedCmd.type,
          ...context
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`Agent ${agentName} timed out`)), this.config.commandTimeout)
        )
      ]);

      agentInfo.status = 'idle';
      agentInfo.stats.calls++;
      
      return {
        success: true,
        agent: agentName,
        data: result,
        timestamp: new Date(),
        summary: result.summary || `${agentName} completed ${parsedCmd.action}`
      };

    } catch (error) {
      agentInfo.status = 'error';
      agentInfo.stats.errors++;
      throw error;
    }
  }

  /**
   * 多智能体协作执行链 (Pipeline模式)
   * 场景: 线上引流 → 到店核销 → 数据回传 → 业绩统计 全闭环
   */
  async executePipeline(pipelineDef, context = {}) {
    const pipelineId = `pipe_${Date.now()}`;
    logger.info(`[Dispatcher] Pipeline started: ${pipelineId}`, { steps: pipelineDef.steps.length });

    const results = [];
    let pipelineContext = { ...context, pipelineId };

    for (let i = 0; i < pipelineDef.steps.length; i++) {
      const step = pipelineDef.steps[i];
      try {
        logger.info(`[Dispatcher] Pipeline step ${i + 1}/${pipelineDef.steps.length}: ${step.agent}.${step.action}`);
        
        const result = await this.dispatch(
          { type: step.domain || step.agent.toLowerCase(), action: step.action, params: step.params },
          pipelineContext
        );

        results.push({ step: i, success: true, ...result });

        // 将上一步结果注入下一步上下文
        pipelineContext[`step_${i}_result`] = result.data;
        pipelineContext.lastResult = result.data;

        // 条件分支
        if (step.condition && !this._evaluateCondition(step.condition, result.data)) {
          if (step.onConditionFail === 'break') {
            logger.info(`[Dispatcher] Pipeline stopped at step ${i + 1}: condition not met`);
            break;
          }
          continue;
        }

      } catch (error) {
        results.push({ step: i, success: false, error: error.message });
        if (pipelineDef.stopOnError !== false) {
          logger.error(`[Dispatcher] Pipeline failed at step ${i + 1}: ${error.message}`);
          break;
        }
      }
    }

    const pipelineResult = {
      pipelineId,
      name: pipelineDef.name,
      totalSteps: pipelineDef.steps.length,
      completedSteps: results.filter(r => r.success).length,
      results,
      duration: Date.now() - parseInt(pipelineId.split('_')[1]),
      success: results.every(r => r.success)
    };

    this.emit('pipeline:completed', pipelineResult);
    return pipelineResult;
  }

  /**
   * 预定义业务Pipeline模板库
   */
  getPipelines() {
    return {
      // Pipeline 1: 线上引流到店完整闭环
      onlineToOffline: {
        name: '线上引流→到店体验→复购留存 闭环',
        description: '从内容发布到会员转化的全流程自动化',
        steps: [
          { agent: 'TrafficAcquisitionAgent', domain: 'marketing', action: 'generateContent', params: { platform: 'xiaohongshu', topic: '新品上市' } },
          { agent: 'TrafficAcquisitionAgent', domain: 'marketing', action: 'publishContent', params: {} },
          { agent: 'TrafficAcquisitionAgent', domain: 'marketing', action: 'monitorEngagement', params: { windowHours: 4 } },
          { agent: 'MemberGrowthAgent', domain: 'member', action: 'captureLeads', params: { source: 'social_media' } },
          { agent: 'MarketingCRMAgent', domain: 'marketing', action: 'sendWelcomeCoupon', params: { couponType: 'first_visit_discount' } },
          { agent: 'StoreOperationAgent', domain: 'store', action: 'prepareForGuests', params: { expectedNewVisits: 20 } },
          { agent: 'SalesGrowthAgent', domain: 'sales', action: 'trackConversion', params: { funnel: 'online_to_offline' } }
        ],
        stopOnError: false
      },

      // Pipeline 2: 啤酒节/大型活动全流程
      eventFullCycle: {
        name: '啤酒节/活动 全流程自动化',
        description: '活动策划→筹备→执行→复盘 完整流程',
        steps: [
          { agent: 'EventExecutionAgent', domain: 'event', action: 'planEvent', params: {} },
          { agent: 'TrafficAcquisitionAgent', domain: 'marketing', action: 'createPromotionMaterials', params: { channels: ['xiaohongshu', 'douyin', 'dianping'] } },
          { agent: 'TrafficAcquisitionAgent', domain: 'marketing', action: 'openTicketSales', params: { platform: 'youzan' } },
          { agent: 'SupplyChainAgent', domain: 'supply', action: 'prepareEventStock', params: { eventType: 'festival' } },
          { agent: 'HRTalentAgent', domain: 'hr', action: 'scheduleEventStaff', params: {} },
          { agent: 'EventExecutionAgent', domain: 'event', action: 'executeEventDay', params: {} },
          { agent: 'SalesGrowthAgent', domain: 'sales', action: 'recordEventRevenue', params: {} },
          { agent: 'FinanceIntelligenceAgent', domain: 'finance', action: 'reconcileEventAccounts', params: {} },
          { agent: 'EventExecutionAgent', domain: 'event', action: 'postEventAnalysis', params: {} },
          { agent: 'MemberGrowthAgent', domain: 'member', action: 'convertEventAttendees', params: {} }
        ]
      },

      // Pipeline 3: 日常自动运营 (每日跑)
      dailyOps: {
        name: '每日自动化运营',
        description: '每日定时运行的标准化运营流程',
        steps: [
          { agent: 'InventoryAgent', domain: 'supply', action: 'syncAllInventory', params: {} },
          { agent: 'FinanceIntelligenceAgent', domain: 'finance', action: 'autoReconciliation', params: { period: 'yesterday' } },
          { agent: 'StoreOperationAgent', domain: 'store', action: 'dailyHealthCheck', params: {} },
          { agent: 'SalesGrowthAgent', domain: 'sales', action: 'generateDailyReport', params: {} },
          { agent: 'MemberGrowthAgent', domain: 'member', action: 'checkChurnRisk', params: {} },
          { agent: 'TrafficAcquisitionAgent', domain: 'marketing', action: 'autoPostScheduledContent', params: {} }
        ]
      },

      // Pipeline 4: 新品上市全流程
      newProductLaunch: {
        name: '新品上市全流程',
        description: '从酿造到上架到推广的新品发布',
        steps: [
          { agent: 'SupplyChainAgent', domain: 'supply', action: 'completeBrewingBatch', params: {} },
          { agent: 'InventoryAgent', domain: 'supply', action: 'receiveNewStock', params: {} },
          { agent: 'YouzanIntegration', domain: 'store', action: 'listProductOnline', params: {} },
          { agent: 'StoreOperationAgent', domain: 'store', action: 'assignToTap', params: { tapId: 'next_available' } },
          { agent: 'TrafficAcquisitionAgent', domain: 'marketing', action: 'launchProductCampaign', params: {} },
          { agent: 'MemberGrowthAgent', domain: 'member', action: 'notifyProductLovers', params: { segment: 'beer_enthusiast' } },
          { agent: 'SalesGrowthAgent', domain: 'sales', action: 'trackProductPerformance', params: { days: 7 } }
        ]
      },

      // Pipeline 5: 供应链补货自动触发
      autoReplenish: {
        name: '低库存自动补货',
        description: '当任一生啤罐装低于安全库存时自动触发补货',
        steps: [
          { agent: 'InventoryAgent', domain: 'supply', action: 'checkStockLevels', params: {} },
          { agent: 'SupplyChainAgent', domain: 'supply', action: 'createPurchaseOrder', params: { autoApprove: true }, condition: 'low_stock_detected' },
          { agent: 'ERPIntegration', domain: 'supply', action: 'submitPOToSupplier', params: {}, condition: 'po_created' },
          { agent: 'FinanceIntelligenceAgent', domain: 'finance', action: 'reserveBudget', params: {}, condition: 'po_submitted' }
        ],
        stopOnError: false
      }
    };
  }

  /**
   * KPI 影响追踪 - 每条指令执行后评估对业绩的影响
   */
  _checkKpiImpact(cmd, result) {
    let impact = null;

    switch (cmd.type) {
      case 'sales':
        impact = { kpi: 'gmv', direction: result.success ? '+' : '=', magnitude: 'medium' };
        break;
      case 'marketing':
        impact = { kpi: 'newMembers', direction: '+', magnitude: result.data?.reach ? 'high' : 'medium' };
        break;
      case 'member':
        impact = { kpi: 'retentionRate', direction: '+', magnitude: cmd.action === 'engage' ? 'medium' : 'low' };
        break;
      default:
        impact = null;
    }

    if (impact) {
      this.emit('kpi:impact', {
        command: cmd.raw,
        ...impact,
        timestamp: new Date()
      });
    }
  }

  /** 更新运行指标 */
  _updateMetrics(agentName, success, duration) {
    this.metrics.successCount++;
    const agentStats = this.metrics.agentStats.get(agentName) || { calls: 0, errors: 0, totalTime: 0 };
    agentStats.calls++;
    agentStats.totalTime += duration;
    agentStats.avgTime = Math.round(agentStats.totalTime / agentStats.calls);
    this.metrics.agentStats.set(agentName, agentStats);
  }

  /** 从文本中提取数字 */
  _extractNumber(text) {
    const match = text.match(/(\d+(?:\.\d+)?)/);
    return match ? parseFloat(match[1]) : null;
  }

  /** 查找备用智能体 */
  _findFallbackAgent(type, action) {
    const candidates = this.agentRegistry.get(`${type}:${action}`) ||
                      Array.from(this.agents.values())
                        .filter(a => a.domain === type)
                        .map(a => a.name);
    return candidates && candidates.length > 0 ? candidates[0] : null;
  }

  /** 条件求值 */
  _evaluateCondition(condition, data) {
    if (typeof condition === 'function') return condition(data);
    if (typeof condition === 'string') {
      const keys = condition.split('.');
      let val = data;
      for (const key of keys) val = val?.[key];
      return !!val;
    }
    return !!condition;
  }

  /** 错误处理 */
  _setupErrorHandling() {
    this.on('error', (err) => {
      logger.error('[Dispatcher] Unhandled error:', err);
    });
  }

  /** 获取系统状态仪表盘 */
  getDashboard() {
    return {
      status: this.isRunning ? 'running' : 'stopped',
      agents: {
        registered: this.agents.size,
        details: Array.from(this.agents.entries()).map(([name, info]) => ({
          name,
          domain: info.domain,
          status: info.status,
          capabilities: info.capabilities.length,
          calls: info.stats.calls,
          errors: info.stats.errors
        }))
      },
      metrics: {
        ...this.metrics,
        agentStats: Object.fromEntries(this.metrics.agentStats)
      },
      commands: {
        total: this.metrics.totalCommands,
        successRate: this.metrics.totalCommands > 0 
          ? ((this.metrics.successCount / this.metrics.totalCommands) * 100).toFixed(1) + '%' 
          : 'N/A'
      },
      recentCommands: this.commandHistory.slice(-10).map(c => ({
        id: c.id, raw: c.raw.substring(0, 60), status: c.status, duration: c.duration }))
    };
  }

  /** 启动调度器 */
  start() {
    this.isRunning = true;
    logger.info('[Dispatcher] Command Dispatcher started');
    this.emit('started');
    return this;
  }

  /** 停止调度器 */
  stop() {
    this.isRunning = false;
    logger.info('[Dispatcher] Command Dispatcher stopped');
    this.emit('stopped');
    return this;
  }
}

module.exports = CommandDispatcher;
