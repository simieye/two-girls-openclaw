/**
 * ============================================================
 * 定时任务调度中心 v3.0 (Cron Scheduler)
 * Two Girls Brew - 自动化运营全流程
 * 
 * 基于真实业务需求设计的定时任务矩阵:
 * - 每5分钟: 关键库存监控 (27龙头生啤)
 * - 每15分钟: 有赞订单同步
 * - 每2小时: 门店巡检
 * - 每日固定时间: 对账/报告/排班/内容发布
 * - 每周固定日期: 会员分析/供应商结算
 * - 事件触发: 库存预警→自动补货, 流失风险→自动召回
 * ============================================================
 */

const cron = require('node-cron');
const EventEmitter = require('events');
const logger = require('../utils/logger');

class CronScheduler extends EventEmitter {
  constructor(dispatcher) {
    super();
    this.dispatcher = dispatcher;
    this.tasks = new Map();
    this.isRunning = false;
    
    this._registerAllTasks();
  }

  /** 注册所有定时任务 */
  _registerAllTasks() {
    // ==================== 高频任务 ====================

    // 每5分钟 - 生啤龙头库存监控
    this.add({
      id: 'tap_inventory_monitor',
      cronExpr: '*/5 * * * *',
      name: '生啤龙头实时监控',
      agent: 'StoreOperationAgent',
      action: 'inventoryCheck',
      params: {},
      description: '每5分钟检查27个龙头酒量，低于阈值自动预警'
    });

    // 每15分钟 - 有赞订单同步
    this.add({
      id: 'youzan_order_sync',
      cronExpr: '*/15 * * * *',
      name: '有赞订单实时同步',
      agent: 'StoreOperationAgent',
      action: 'syncAllInventory',
      params: {},
      description: '同步有赞微商城+门店小程序最新订单到ERP和财务系统'
    });

    // ==================== 中频任务 ====================

    // 每2小时 - 门店健康巡检
    this.add({
      id: 'store_health_check',
      cronExpr: '0 */2 * * *',
      name: '门店健康巡检',
      agent: 'StoreOperationAgent',
      action: 'dailyHealthCheck',
      params: {},
      description: '检查设备状态(CO2/温度/清洁)并生成巡检报告'
    });

    // ==================== 日任务 ====================

    // 凌晨2:00 - 每日自动对账
    this.add({
      id: 'daily_auto_reconciliation',
      cronExpr: '0 2 * * *',
      name: '每日财务对账',
      agent: 'FinanceIntelligenceAgent',
      action: 'autoReconciliation',
      params: { period: 'yesterday' },
      description: '自动对账(有赞+POS+现金)，生成日结报告'
    });

    // 凌晨2:30 - 每日销售报表
    this.add({
      id: 'daily_sales_report',
      cronExpr: '30 2 * * *',
      name: '每日销售报告',
      agent: 'SalesGrowthAgent',
      action: 'report',
      params: { period: 'daily' },
      description: '生成GMV/订单量/客单价/热销TOP10等核心指标'
    });

    // 上午10:00 - 每日内容自动发布
    this.add({
      id: 'daily_content_publish',
      cronExpr: '0 10 * * *',
      name: '每日内容发布',
      agent: 'TrafficAcquisitionAgent',
      action: 'autoPostScheduledContent',
      params: {},
      description: '根据时间表自动发布小红书/抖音/点评/微信内容'
    });

    // 上午11:00 - 每日会员流失检查
    this.add({
      id: 'daily_churn_check',
      cronExpr: '0 11 * * *',
      name: '会员流失检查',
      agent: 'MemberGrowthAgent',
      action: 'checkChurnRisk',
      params: {},
      description: '识别高风险流失客户，触发召回流程'
    });

    // 下午14:00 - 排班确认
    this.add({
      id: 'daily_schedule_confirm',
      cronExpr: '0 14 * * *',
      name: '排班确认提醒',
      agent: 'HRTalentAgent',
      action: 'manageSchedule',
      params: {},
      description: '确认当日排班，异常情况及时调整'
    });

    // 晚上22:00 - 每日互动监控汇总
    this.add({
      id: 'daily_engagement_summary',
      cronExpr: '0 22 * * *',
      name: '互动数据汇总',
      agent: 'TrafficAcquisitionAgent',
      action: 'monitorEngagement',
      params: { windowHours: 24 },
      description: '汇总全平台互动数据(点赞/评论/分享/关注)'
    });

    // 晚上23:00 - 评价处理
    this.add({
      id: 'daily_review_processing',
      cronExpr: '0 23 * * *',
      name: '每日评价处理',
      agent: 'StoreOperationAgent',
      action: 'handleReviews',
      params: { autoRespond: true },
      description: '拉取各平台新评价，情感分析+自动回复'
    });

    // ==================== 周任务 ====================

    // 周一 09:00 - RFM会员分析
    this.add({
      id: 'weekly_rfm_analysis',
      cronExpr: '0 9 * * 1',
      name: '周度RFM会员分析',
      agent: 'MemberGrowthAgent',
      action: 'analyze',
      params: {},
      description: '每周一执行RFM模型分析，更新用户分群和策略'
    });

    // 周一 10:00 - 销售预测
    this.add({
      id: 'weekly_sales_forecast',
      cronExpr: '0 10 * * 1',
      name: '周度销售预测',
      agent: 'SalesGrowthAgent',
      action: 'forecast',
      params: {},
      description: '基于历史数据和当前趋势预测下周GMV'
    });

    // 周三 15:00 - 供应链采购检查
    this.add({
      id: 'weekly_supply_check',
      cronExpr: '0 15 * * 3',
      name: '供应链采购检查',
      agent: 'SupplyChainAgent',
      action: 'checkStockLevels',
      params: {},
      description: '全面盘点原料/包材/成品库存，生成补货建议'
    });

    // 周五 12:00 - 周末活动准备
    this.add({
      id: 'weekend_prep',
      cronExpr: '0 12 * * 5',
      name: '周末运营准备',
      agent: 'StoreOperationAgent',
      action: 'prepareForGuests',
      params: { expectedNewVisits: 80 },
      description: '为周末客流高峰做准备（库存/人员/物料）'
    });

    // ==================== 月任务 ====================
    
    // 每月1号 08:00 - 月度全面报告
    this.add({
      id: 'monthly_full_report',
      cronExpr: '0 8 1 * *',
      name: '月度综合报告',
      agent: 'SalesGrowthAgent',
      action: 'report',
      params: { period: 'monthly' },
      description: '生成月度经营分析报告(GMV/利润/会员/渠道)'
    });

    // 每月8号 - 会员日自动化
    this.add({
      id: 'membership_day',
      cronExpr: '0 9 8 * *',
      name: '每月8号会员日活动',
      agent: 'TrafficAcquisitionAgent',
      action: 'distributeCoupon',
      params: { type: 'happy_hour', count: 500 },
      description: '会员日自动发放专属优惠券+双倍积分激活'
    });
  }

  /** 添加定时任务 */
  add(taskDef) {
    if (!cron.validate(taskDef.cronExpr)) {
      throw new Error(`Invalid cron expression: ${taskDef.cronExpr}`);
    }
    
    this.tasks.set(taskDef.id, { ...def, enabled: true, lastRun: null, nextRun: null, runCount: 0, errors: 0 });
    logger.info(`[Scheduler] Task registered: ${taskDef.id} (${taskDef.cronExpr}) - ${taskDef.name}`);
    return this;
  }

  /** 启动所有定时任务 */
  start() {
    if (this.isRunning) return this;

    this.isRunning = true;

    this.tasks.forEach((task, id) => {
      if (!task.enabled) return;

      const job = cron.schedule(task.cronExpr, async () => {
        const startTime = Date.now();
        logger.info(`[Scheduler] ⏰ Running task: ${task.name} (${id})`);

        try {
          const result = await this.dispatcher.dispatch(
            { type: task.agent.replace('Agent', '').toLowerCase(), action: task.action, params: task.params },
            { source: 'cron_scheduler', taskId: id }
          );

          task.lastRun = new Date();
          task.runCount++;
          task.lastResult = result;
          
          logger.info(`[Scheduler] ✅ Task completed: ${task.name} in ${Date.now() - startTime}ms`);
          this.emit('task:completed', { id, ...task, result, duration: Date.now() - startTime });

        } catch (error) {
          task.errors++;
          logger.error(`[Scheduler] ❌ Task failed: ${task.name} - ${error.message}`);
          this.emit('task:error', { id, error: error.message, task });
        }
      }, { scheduled: false });

      task._job = job;
      job.start();
    });

    logger.info(`[Scheduler] Started with ${this.tasks.size} tasks`);
    this.emit('started', { totalTasks: this.tasks.size });
    return this;
  }

  /** 停止所有任务 */
  stop() {
    this.tasks.forEach((task) => {
      if (task._job) task._job.stop();
    });
    this.isRunning = false;
    logger.info('[Scheduler] All tasks stopped');
    this.emit('stopped');
    return this;
  }

  /** 手动触发某个任务 */
  async trigger(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);

    logger.info(`[Scheduler] 🔴 Manual trigger: ${task.name}`);
    return await this.dispatcher.dispatch(
      { type: task.agent.replace('Agent', '').toLowerCase(), action: task.action, params: task.params },
      { source: 'manual_trigger', taskId }
    );
  }

  /** 获取所有任务状态 */
  getStatus() {
    return {
      isRunning: this.isRunning,
      totalTasks: this.tasks.size,
      activeTasks: Array.from(this.tasks.values()).filter(t => t.enabled).length,
      tasks: Array.from(this.tasks.entries()).map(([id, task]) => ({
        id,
        name: task.name,
        cron: task.cronExpr,
        enabled: task.enabled,
        runCount: task.runCount,
        errors: task.errors,
        lastRun: task.lastRun,
        status: task.enabled ? 'active' : 'disabled'
      }))
    };
  }
}

module.exports = CronScheduler;
