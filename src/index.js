/**
 * ============================================================
 * 🍺 Two Girls Brew (两女孩精酿) 智能体矩阵系统 v3.0
 * 
 * 全流程自动化运营管理系统
 * ─────────────────────────────────────
 * 线上引流 → 到店体验 → 供应链支撑 → 业绩增长
 * ─────────────────────────────────────
 * 
 * 数据互联互通:
 *   有赞微商城API ←→ 总部财务系统API
 *   有赞门店小程序 ←→ HR系统API  
 *   ERP供应链API ←→ 全部数据互通
 * 
 * 调度方式:
 *   - OpenClaw 统一指令调度 (自然语言/结构化)
 *   - 定时任务自动执行 (15个cron job)
 *   - Pipeline多智能体协作流水线
 * 
 * 启动: npm start
 * 指令示例:
 *   node src/index.js "查看今日销售报表"
 *   node src/index.js "marketing:launch:xiaohongshu"
 *   node src/index.js --pipeline onlineToOffline
 *   node src/index.js --dashboard
 * ============================================================
 */

require('dotenv').config();

const CommandDispatcher = require('./core/command-dispatcher');
const CronScheduler = require('./scheduler/cron-scheduler');
const { registerAllAgents } = require('./agents');
const { knowledgeBase } = require('./knowledge-base/business-knowledge');
const logger = require('./utils/logger');

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const flag = args.find(a => a.startsWith('--'));
  const flagValue = flag ? flag.replace('--', '') : null;

  // ========== 初始化 ==========
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  🍺 TWO GIRLS BREW - 智能体矩阵系统 v3.0        ║');
  console.log('║     THE LIFETIME OF LOVE since 2012             ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');

  // 创建调度器
  const dispatcher = new CommandDispatcher({
    maxConcurrentAgents: 10,
    commandTimeout: 30000,
    enableMetrics: true
  });

  // 注册所有智能体
  const registration = registerAllAgents(dispatcher, {
    youzan: {
      clientId: process.env.YOUZAN_CLIENT_ID,
      clientSecret: process.env.YOUZAN_CLIENT_SECRET,
      shopId: process.env.YOUZAN_SHOP_ID,
      kdtId: process.env.YOUZAN_KDT_ID
    },
    finance: {
      baseUrl: process.env.FINANCE_API_BASE_URL,
      apiKey: process.env.FINANCE_API_KEY
    },
    hr: {
      baseUrl: process.env.HR_API_BASE_URL,
      apiKey: process.env.HR_API_KEY
    },
    erp: {
      baseUrl: process.env.ERP_API_BASE_URL,
      apiKey: process.env.ERP_API_KEY
    }
  });

  logger.info(`✅ 已注册 ${registration.registered} 个智能体:`);
  registration.agents.forEach(a => {
    logger.info(`   ├─ ${a.name.padEnd(28)} [${a.domain.padEnd(12)}] ${a.capabilities}个能力`);
  });

  // 启动定时任务调度器
  const scheduler = new CronScheduler(dispatcher);

  // ========== 根据参数决定运行模式 ==========

  if (flagValue === 'dashboard' || (!command && !flag)) {
    // Dashboard模式 - 显示系统状态
    dispatcher.start();
    
    console.log('\n📊 系统状态仪表板\n');
    console.log(JSON.stringify(dispatcher.getDashboard(), null, 2));
    console.log('\n📋 定时任务列表\n');
    scheduler.start();
    console.log(JSON.stringify(scheduler.getStatus(), null, 2));
    
    return;
  }

  if (flagValue === 'scheduler') {
    // 定时任务模式 - 启动所有cron并持续运行
    dispatcher.start();
    scheduler.start();
    
    console.log(`\n⏰ 定时任务调度中心已启动 (${scheduler.getStatus().totalTasks} 个任务)`);
    console.log('按 Ctrl+C 停止...\n');
    
    // 保持运行
    return new Promise(() => {});
  }

  if (flagValue === 'pipeline') {
    // Pipeline模式 - 执行预定义协作流程
    dispatcher.start();
    const pipelines = dispatcher.getPipelines();
    const pipelineName = args[args.indexOf('--pipeline') + 1] || 'dailyOps';
    const pipelineDef = pipelines[pipelineName];

    if (!pipelineDef) {
      console.log(`\n❌ Pipeline "${pipelineName}" 不存在`);
      console.log(`\n可用的Pipeline:`);
      Object.keys(pipelines).forEach(name => {
        console.log(`   • ${name}: ${(pipelines[name].name || '').substring(0, 40)}... (${pipelines[name].steps.length}步)`);
      });
      return;
    }

    console.log(`\n🚀 执行Pipeline: ${pipelineDef.name}`);
    console.log(`   步骤数: ${pipelineDef.steps.length}\n`);

    const result = await dispatcher.executePipeline(pipelineDef, { triggeredBy: 'cli' });
    
    console.log('\n📋 Pipeline 执行结果:\n');
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === '--knowledge') {
    // 显示业务知识库摘要
    console.log('\n📚 Two Girls Brew 业务知识库\n');
    console.log(`品牌: ${knowledgeBase.brand.nameCn} (${knowledgeBase.brand.slogan})`);
    console.log(`生啤酒单: ${knowledgeBase.products.draftBeer.length}款龙头酒款`);
    console.log(`活动酒单: ${knowledgeBase.products.eventBeers.length}款活动限定`);
    console.log(`罐装产品: ${knowledgeBase.products.cannedBeer.length}款`);
    console.log(`BBQ菜单: ${knowledgeBase.products.bbqMenu.categories.length}个分类`);
    console.log(`门店: ${knowledgeBase.stores.flagship.name} (${knowledgeBase.stores.flagship.features.tapSystem?.totalTaps || 27}龙头)`);
    console.log(`渠道: ${Object.keys(knowledgeBase.channels.online).length + Object.keys(knowledgeBase.channels.offline.length)}个`);
    console.log(`月GMV目标: ¥${knowledgeBase.kpiTargets.monthly.gmv.target.toLocaleString()}`);
    return;
  }

  if (command) {
    // 单条指令模式
    dispatcher.start();
    
    console.log(`\n📨 执行指令: "${command}"\n`);

    try {
      const result = await dispatcher.dispatch(command, { source: 'cli' });
      
      console.log('✅ 执行结果:\n');
      console.log(JSON.stringify(result, null, 2));
      console.log(`\n💡 摘要: ${result.summary}`);

    } catch (error) {
      console.error(`❌ 执行失败: ${error.message}`);
      console.error(error.stack);
      process.exit(1);
    }
    return;
  }
}

// CLI入口
main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
