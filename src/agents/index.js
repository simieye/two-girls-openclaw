/**
 * ============================================================
 * 智能体注册中心 v3.0 - Two Girls Brew 完整矩阵
 * 
 * 智能体架构:
 * ┌──────────────────────────────────────────────┐
 * │              Command Dispatcher               │
 * │         (OpenClaw 统一指令调度引擎)            │
 * ├──────────────────────────────────────────────┤
 * │  线上引流    │  门店运营   │  供应链     │
 * │  TrafficAcq.│  StoreOper. │  SupplyChain │
 * ├─────────────┼─────────────┼─────────────┤
 * │  营销/活动  │  会员增长   │  销售增长   │  财务  │  HR  │  扩张  │
 * │ EventExec   │ MemberGrow  │ SalesGrowth │ Fin  │ HR  │ Expand│
 * └─────────────┴─────────────┴─────────────┴─────┴─────┴───────┘
 */

const TrafficAcquisitionAgent = require('./traffic-acquisition-agent');
const StoreOperationAgent = require('./store-operation-agent');
const SupplyChainAgent = require('./supply-chain-agent');
const EventExecutionAgent = require('./event-execution-agent');
const MemberGrowthAgent = require('./member-growth-agent');
const SalesGrowthAgent = require('./sales-growth-agent');
const FinanceIntelligenceAgent = require('./finance-agent');
const HRTalentAgent = require('./hr-agent');
const ExpansionAgent = require('./expansion-agent');

// 导出所有智能体类
module.exports = {
  TrafficAcquisitionAgent,
  StoreOperationAgent,
  SupplyChainAgent,
  EventExecutionAgent,
  MemberGrowthAgent,
  SalesGrowthAgent,
  FinanceIntelligenceAgent,
  HRTalentAgent,
  ExpansionAgent,

  /**
   * 创建并注册所有智能体到调度器
   */
  registerAllAgents(dispatcher, config = {}) {
    const agents = [
      new TrafficAcquisitionAgent(config),
      new StoreOperationAgent(config),
      new SupplyChainAgent(config),
      new EventExecutionAgent(config),
      new MemberGrowthAgent(config),
      new SalesGrowthAgent(config),
      new FinanceIntelligenceAgent(config),
      new HRTalentAgent(config),
      new ExpansionAgent(config)
    ];

    agents.forEach(agent => dispatcher.registerAgent(agent));

    return {
      registered: agents.length,
      agents: agents.map(a => ({ name: a.name, domain: a.domain, capabilities: a.capabilities.length }))
    };
  }
};
