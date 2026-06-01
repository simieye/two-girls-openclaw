/**
 * 总部财务系统 API 客户端
 * 对接用友/金蝶等财务系统，实现自动对账、发票识别、成本核算
 */

const axios = require('axios');
const crypto = require('crypto');
const { logger } = require('../utils/logger');
const config = require('../config');

class FinanceAPIClient {
  constructor() {
    this.baseURL = config.finance.apiBase;
    this.apiKey = config.finance.apiKey;
    this.systemType = config.finance.systemType;

    this.http = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
      },
    });

    this.http.interceptors.response.use(
      (res) => res.data,
      (err) => {
        logger.error('财务系统API请求失败', {
          url: err.config?.url,
          status: err.response?.status,
          error: err.message,
        });
        throw err;
      }
    );
  }

  /** 生成请求签名 */
  generateSignature(data) {
    const payload = JSON.stringify(data);
    return crypto.createHmac('sha256', this.apiKey).update(payload).digest('hex');
  }

  async request(method, path, data = null) {
    const config = {
      method,
      url: path,
      headers: {},
    };
    if (data) {
      config.data = data;
      config.headers['X-Signature'] = this.generateSignature(data);
    }
    return this.http.request(config);
  }

  // ==========================================
  // 自动对账
  // ==========================================

  /** 获取科目余额 */
  async getAccountBalance(accountCode, period) {
    return this.request('GET', `/accounts/${accountCode}/balance`, null, {
      params: { period },
    });
  }

  /** 获取银行流水 */
  async getBankStatements(bankAccount, startDate, endDate) {
    return this.request('GET', `/bank-statements`, null, {
      params: { account: bankAccount, start: startDate, end: endDate },
    });
  }

  /** 执行自动对账 */
  async autoReconcile(params) {
    return this.request('POST', '/reconcile/auto', {
      start_date: params.startDate,
      end_date: params.endDate,
      bank_account: params.bankAccount,
      tolerance: params.tolerance || 0.01,
      auto_confirm: params.autoConfirm || false,
    });
  }

  /** 获取对账结果 */
  async getReconcileResult(reconcileId) {
    return this.request('GET', `/reconcile/${reconcileId}/result`);
  }

  // ==========================================
  // 发票管理
  // ==========================================

  /** 发票识别 (OCR) */
  async recognizeInvoice(imageBase64) {
    return this.request('POST', '/invoices/recognize', {
      image: imageBase64,
    });
  }

  /** 发票验真 */
  async verifyInvoice(invoiceCode, invoiceNumber, invoiceDate, amount) {
    return this.request('POST', '/invoices/verify', {
      invoice_code: invoiceCode,
      invoice_number: invoiceNumber,
      invoice_date: invoiceDate,
      amount,
    });
  }

  /** 获取进项发票列表 */
  async getInputInvoices(params = {}) {
    return this.request('GET', '/invoices/input', null, { params });
  }

  // ==========================================
  // 成本核算
  // ==========================================

  /** 门店成本核算 */
  async calculateStoreCost(storeId, period) {
    return this.request('POST', '/cost/store/calculate', {
      store_id: storeId,
      period,
    });
  }

  /** 商品成本分析 */
  async analyzeProductCost(itemId, startDate, endDate) {
    return this.request('GET', `/cost/product/${itemId}/analysis`, null, {
      params: { start: startDate, end: endDate },
    });
  }

  /** 获取总成本报表 */
  async getCostReport(period, dimension = 'store') {
    return this.request('GET', '/cost/report', null, {
      params: { period, dimension },
    });
  }

  // ==========================================
  // 财务报表
  // ==========================================

  /** 利润表 */
  async getProfitLossStatement(period) {
    return this.request('GET', '/reports/profit-loss', null, {
      params: { period },
    });
  }

  /** 门店绩效报表 */
  async getStorePerformance(startDate, endDate) {
    return this.request('GET', '/reports/store-performance', null, {
      params: { start: startDate, end: endDate },
    });
  }

  /** 现金流预测 */
  async getCashflowForecast(days = 90) {
    return this.request('GET', '/forecast/cashflow', null, {
      params: { days },
    });
  }

  // ==========================================
  // 支付对账 (有赞 → 财务)
  // ==========================================

  /** 导入有赞支付流水 */
  async importYouzanPayments(payments) {
    return this.request('POST', '/import/youzan-payments', {
      payments,
      source: 'youzan',
    });
  }

  /** 获取支付对账差异 */
  async getPaymentDiscrepancies(startDate, endDate) {
    return this.request('GET', '/reconcile/payment-discrepancies', null, {
      params: { start: startDate, end: endDate },
    });
  }
}

const financeClient = new FinanceAPIClient();
module.exports = { financeClient, FinanceAPIClient };
