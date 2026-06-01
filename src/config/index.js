/**
 * 配置管理模块 - 统一读取环境变量和配置文件
 */

require('dotenv').config();

const config = {
  // === 有赞云 API ===
  youzan: {
    clientId: process.env.YOUZAN_CLIENT_ID,
    clientSecret: process.env.YOUZAN_CLIENT_SECRET,
    kdtId: process.env.YOUZAN_KDT_ID,
    apiBase: process.env.YOUZAN_API_BASE || 'https://open.youzanyun.com/api',
    authBase: process.env.YOUZAN_AUTH_BASE || 'https://open.youzanyun.com/auth/token',
    storeShopIds: (process.env.YOUZAN_STORE_SHOP_IDS || 'store_001,store_002,store_003,store_004,store_005,store_006').split(','),
    accessToken: null,
    tokenExpireAt: null,
  },

  // === 总部财务系统 ===
  finance: {
    apiBase: process.env.FINANCE_API_BASE || 'http://internal-finance.cleverbrew.com/api/v2',
    apiKey: process.env.FINANCE_API_KEY,
    systemType: process.env.FINANCE_SYSTEM_TYPE || 'yonyou',
  },

  // === HR 系统 ===
  hr: {
    apiBase: process.env.HR_API_BASE || 'http://internal-hr.cleverbrew.com/api/v2',
    apiKey: process.env.HR_API_KEY,
    systemType: process.env.HR_SYSTEM_TYPE || 'feishu',
  },

  // === ERP 供应链 ===
  erp: {
    apiBase: process.env.ERP_API_BASE || 'http://internal-erp.cleverbrew.com/api/v2',
    apiKey: process.env.ERP_API_KEY,
    systemType: process.env.ERP_SYSTEM_TYPE || 'yonyou_scm',
  },

  // === OpenClaw ===
  openclaw: {
    home: process.env.OPENCLAW_HOME || '~/.openclaw',
    workspace: process.env.OPENCLAW_WORKSPACE || '~/.openclaw/workspace',
    modelDefault: process.env.OPENCLAW_MODEL_DEFAULT || 'anthropic/claude-sonnet-4-5',
    modelOrchestrator: process.env.OPENCLAW_MODEL_ORCHESTRATOR || 'anthropic/claude-opus-4-5',
    maxConcurrent: parseInt(process.env.OPENCLAW_MAX_CONCURRENT || '8'),
  },

  // === Redis ===
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || '',
  },

  // === 数据库 ===
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '5432'),
    name: process.env.DB_NAME || 'clever_brew_agents',
    user: process.env.DB_USER || 'cleverbrew',
    password: process.env.DB_PASSWORD || '',
  },

  // === 门店 ===
  stores: {
    count: parseInt(process.env.STORE_MAC_COUNT || '6'),
    macModel: process.env.STORE_MAC_MODEL || 'mac_mini_m4',
    ids: ['store_001', 'store_002', 'store_003', 'store_004', 'store_005', 'store_006'],
  },

  // === 日志 ===
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    dir: process.env.LOG_DIR || './logs',
  },

  // === 定时任务 ===
  cron: {
    enabled: process.env.CRON_ENABLED !== 'false',
    supplyMonitor: process.env.CRON_SUPPLY_MONITOR || '*/5 * * * *',
    inventorySync: process.env.CRON_INVENTORY_SYNC || '*/15 * * * *',
    storePatrol: process.env.CRON_STORE_PATROL || '0 */2 * * *',
    marketingReport: process.env.CRON_MARKETING_REPORT || '0 6 * * 1',
    financeReconcile: process.env.CRON_FINANCE_RECONCILE || '0 2 * * *',
    hrSchedule: process.env.CRON_HR_SCHEDULE || '0 0 * * 1',
    erpSync: process.env.CRON_ERP_SYNC || '0 */1 * * *',
  },
};

module.exports = config;
