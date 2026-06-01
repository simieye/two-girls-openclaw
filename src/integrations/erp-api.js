/**
 * ERP 供应链 API 客户端
 * 对接用友/金蝶SCM系统，实现采购、库存、物流全链路管理
 */

const axios = require('axios');
const { logger } = require('../utils/logger');
const config = require('../config');

class ERPAPIClient {
  constructor() {
    this.baseURL = config.erp.apiBase;
    this.apiKey = config.erp.apiKey;
    this.systemType = config.erp.systemType;

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
        logger.error('ERP系统API请求失败', {
          url: err.config?.url,
          status: err.response?.status,
          error: err.message,
        });
        throw err;
      }
    );
  }

  // ==========================================
  // 供应商管理
  // ==========================================

  /** 获取供应商列表 */
  async getVendorList(params = {}) {
    return this.http.get('/vendors', { params });
  }

  /** 获取供应商详情 */
  async getVendorDetail(vendorId) {
    return this.http.get(`/vendors/${vendorId}`);
  }

  /** 供应商评估 */
  async evaluateVendor(vendorId, criteria) {
    return this.http.post(`/vendors/${vendorId}/evaluate`, criteria);
  }

  /** 供应商比价 */
  async compareVendors(materialCodes, quantity) {
    return this.http.post('/vendors/compare', {
      materials: materialCodes,
      quantity,
    });
  }

  // ==========================================
  // 采购管理
  // ==========================================

  /** 创建采购订单 */
  async createPurchaseOrder(order) {
    return this.http.post('/purchase-orders', {
      vendor_id: order.vendorId,
      items: order.items,
      delivery_date: order.deliveryDate,
      store_id: order.storeId,
      notes: order.notes,
    });
  }

  /** 获取采购订单列表 */
  async getPurchaseOrders(params = {}) {
    return this.http.get('/purchase-orders', { params });
  }

  /** 采购订单审批 */
  async approvePurchaseOrder(orderId, approverId) {
    return this.http.post(`/purchase-orders/${orderId}/approve`, {
      approver_id: approverId,
    });
  }

  /** 采购订单收货确认 */
  async confirmReceipt(orderId, items) {
    return this.http.post(`/purchase-orders/${orderId}/receipt`, {
      items,
      received_at: new Date().toISOString(),
    });
  }

  // ==========================================
  // 库存管理
  // ==========================================

  /** 获取库存快照 */
  async getInventorySnapshot(warehouseId = null) {
    return this.http.get('/inventory/snapshot', {
      params: warehouseId ? { warehouse_id: warehouseId } : {},
    });
  }

  /** 库存预警 */
  async getInventoryAlerts() {
    return this.http.get('/inventory/alerts');
  }

  /** 库存调拨 */
  async transferInventory(fromWarehouse, toWarehouse, items) {
    return this.http.post('/inventory/transfer', {
      from: fromWarehouse,
      to: toWarehouse,
      items,
    });
  }

  /** 库存盘点 */
  async stocktake(warehouseId, items) {
    return this.http.post('/inventory/stocktake', {
      warehouse_id: warehouseId,
      items,
      counted_at: new Date().toISOString(),
    });
  }

  // ==========================================
  // 物流管理
  // ==========================================

  /** 创建出库单 */
  async createOutboundOrder(order) {
    return this.http.post('/logistics/outbound', {
      order_id: order.orderId,
      warehouse_id: order.warehouseId,
      destination: order.destination,
      items: order.items,
      priority: order.priority || 'normal',
    });
  }

  /** 查询物流状态 */
  async getLogisticsStatus(trackingNumber) {
    return this.http.get(`/logistics/track/${trackingNumber}`);
  }

  /** 获取配送路线 */
  async getDeliveryRoutes(storeIds) {
    return this.http.post('/logistics/routes/optimize', {
      stores: storeIds,
    });
  }

  // ==========================================
  // 数据同步
  // ==========================================

  /** ERP → 有赞 商品同步 */
  async syncGoodsToYouzan(items) {
    return this.http.post('/sync/to-youzan/goods', { items });
  }

  /** 有赞 → ERP 订单同步 */
  async syncOrdersFromYouzan(orders) {
    return this.http.post('/sync/from-youzan/orders', { orders });
  }

  /** 全量数据同步 */
  async fullSync() {
    return this.http.post('/sync/full', {
      timestamp: new Date().toISOString(),
    });
  }

  // ==========================================
  // 报表与分析
  // ==========================================

  /** 供应链效率报表 */
  async getSupplyChainEfficiency(startDate, endDate) {
    return this.http.get('/reports/supply-chain-efficiency', {
      params: { start: startDate, end: endDate },
    });
  }

  /** 采购分析 */
  async getProcurementAnalysis(startDate, endDate) {
    return this.http.get('/reports/procurement-analysis', {
      params: { start: startDate, end: endDate },
    });
  }

  /** 库存周转率 */
  async getInventoryTurnover(period) {
    return this.http.get('/reports/inventory-turnover', {
      params: { period },
    });
  }
}

const erpClient = new ERPAPIClient();
module.exports = { erpClient, ERPAPIClient };
