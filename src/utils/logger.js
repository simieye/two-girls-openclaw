/**
 * 日志模块 - 统一日志管理
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');
const config = require('../config');

const logDir = config.logging.dir;
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'clever-brew-agent-matrix' },
  transports: [
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 10 * 1024 * 1024,
      maxFiles: 10,
    }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message, agent, ...meta }) => {
          const agentTag = agent ? `[${agent}] ` : '';
          const metaStr = Object.keys(meta).length > 1 ? ` ${JSON.stringify(meta)}` : '';
          return `${timestamp} ${level}: ${agentTag}${message}${metaStr}`;
        })
      ),
    }),
  ],
});

// 为每个智能体创建专用logger
function createAgentLogger(agentName) {
  return {
    info: (msg, meta = {}) => logger.info(msg, { agent: agentName, ...meta }),
    warn: (msg, meta = {}) => logger.warn(msg, { agent: agentName, ...meta }),
    error: (msg, meta = {}) => logger.error(msg, { agent: agentName, ...meta }),
    debug: (msg, meta = {}) => logger.debug(msg, { agent: agentName, ...meta }),
  };
}

module.exports = { logger, createAgentLogger };
