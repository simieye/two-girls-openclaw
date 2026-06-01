/**
 * 有赞云 API 客户端
 * 统一封装微商城、门店、交易、商品、库存等核心API
 */

const axios = require('axios');
const crypto = require('crypto');
const { logger } = require('../utils/logger');
const config = require('../config');

class YouzanAPIClient {
  constructor() {
    this.baseURL = config.youzan.apiBase;
    this.authBase = config.youzan.authBase;
    this.clientId = config.youzan.clientId;
    this.clientSecret = config.youzan.clientSecret;
    this.kdtId = config.youzan.kdtId;
    this.accessToken = config.youzan.accessToken;
    this.tokenExpireAt = config.youzan.tokenExpireAt;
    this.storeShopIds = config.youzan.storeShopIds;
    
    this.http = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
    });

    // 请求拦截器 - 自动注入token
    this.http.interceptors.request.use(async (reqConfig) => {
      if (!this.accessToken || this.isTokenExpired()) {
        await this.refreshToken();
      }
      reqConfig.headers['Authorization'] = `Bearer ${this.accessToken}`;
      return reqConfig;
    });

    // 响应拦截器
    this.http.interceptors.response.use(
      (res) => res.data,
      (err) => {
        logger.error('有赞API请求失败', { 
          url: err.config?.url, 
          status: err.response?.status,
          error: err.message 
        });
        throw err;
      }
    );
  }

  isTokenExpired() {
    return !this.tokenExpireAt || Date.now() > this.tokenExpireAt - 60000;
  }

  async refreshToken() {
    try {
      const res = await axios.post(`${this.authBase}`, {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'client_credentials',
      });
      this.accessToken = res.data.access_token;
      this.tokenExpireAt = Date.now() + (res.data.expires_in || 7200) * 1000;
      logger.info('✅ 有赞Token刷新成功');
    } catch (err) {
      logger.error('❌ 有赞Token刷新失败', { error: err.message });
      throw err;
    }
  }

  async request(method, path, params = {}, data = null) {
    const response = await this.http.request({
      method,
      url: path,
      params: { ...params, kdt_id: this.kdtId },
      data,
    });
    return response;
  }

  // ==========================================
  // 商品 API
  // ==========================================
  
  /** 获取商品列表 */
  async getGoodsList(params = {}) {
    return this.request('GET', '/youzan.items.onsale.get/3.0.0', params);
  }

  /** 获取商品详情 */
  async getGoodsDetail(itemId) {
    return this.request('GET', '/youzan.item.get/3.0.0', { item_id: itemId });
  }

  /** 批量获取商品库存 */
  async getGoodsInventoryBatch(itemIds) {
    return this.request('GET', '/youzan.items.inventory.get/3.0.0', { 
      item_ids: itemIds.join(',') 
    });
  }

  /** 更新商品库存 */
  async updateGoodsInventory(itemId, skuId, quantity) {
    return this.request('POST', '/youzan.item.quantity.update/3.0.1', {}, {
      item_id: itemId,
      sku_id: skuId,
      quantity,
    });
  }

  // ==========================================
  // 订单/交易 API
  // ==========================================

  /** 获取订单列表 */
  async getOrderList(params = {}) {
    return this.request('GET', '/youzan.trades.sold.get/4.0.0', {
      page_no: params.pageNo || 1,
      page_size: params.pageSize || 20,
      start_created: params.startCreated,
      end_created: params.endCreated,
      status: params.status,
    });
  }

  /** 获取订单详情 */
  async getOrderDetail(tradeId) {
    return this.request('GET', '/youzan.trade.get/4.0.0', { 
      tid: tradeId 
    });
  }

  /** 获取订单统计 */
  async getOrderStats(startDate, endDate) {
    return this.request('GET', '/youzan.trades.sold.get/4.0.0', {
      start_created: startDate,
      end_created: endDate,
      page_size: 1,
      fields: 'total_count,total_fee',
    });
  }

  /** 获取退款列表 */
  async getRefundList(params = {}) {
    return this.request('GET', '/youzan.trade.refund.search/3.0.0', params);
  }

  // ==========================================
  // 门店 API
  // ==========================================

  /** 获取多门店列表 */
  async getStoreList() {
    return this.request('GET', '/youzan.multistore.offlines.get/1.0.0');
  }

  /** 获取门店详情 */
  async getStoreDetail(storeId) {
    return this.request('GET', '/youzan.multistore.offline.get/1.0.0', {
      id: storeId,
    });
  }

  /** 获取门店订单 */
  async getStoreOrders(storeId, params = {}) {
    return this.request('GET', '/youzan.trades.sold.get/4.0.0', {
      ...params,
      offline_id: storeId,
    });
  }

  /** 门店自提订单核销 */
  async verifyPickupOrder(tradeId, verifyCode) {
    return this.request('POST', '/youzan.trade.selffetchcode.apply/3.0.0', {}, {
      code: verifyCode,
      tid: tradeId,
    });
  }

  // ==========================================
  // 会员 API
  // ==========================================

  /** 获取会员列表 */
  async getMemberList(params = {}) {
    return this.request('GET', '/youzan.scrm.customer.search/3.0.0', {
      page: params.page || 1,
      page_size: params.pageSize || 20,
    });
  }

  /** 获取会员详情 */
  async getMemberDetail(yzOpenId) {
    return this.request('GET', '/youzan.scrm.customer.get/3.1.0', {
      yz_open_id: yzOpenId,
    });
  }

  /** 获取会员积分 */
  async getMemberPoints(yzOpenId) {
    return this.request('GET', '/youzan.crm.customer.points.changelog.search/4.0.0', {
      yz_open_id: yzOpenId,
    });
  }

  // ==========================================
  // 营销 API
  // ==========================================

  /** 创建优惠券 */
  async createCoupon(params) {
    return this.request('POST', '/youzan.ump.coupon.create/3.0.0', {}, params);
  }

  /** 发放优惠券 */
  async sendCoupon(couponGroupId, yzOpenId) {
    return this.request('POST', '/youzan.ump.coupon.take/3.0.0', {}, {
      coupon_group_id: couponGroupId,
      yz_open_id: yzOpenId,
    });
  }

  // ==========================================
  // 数据汇总 API
  // ==========================================

  /** 获取所有门店销售汇总 */
  async getAllStoresSalesSummary(startDate, endDate) {
    const results = [];
    for (const storeId of this.storeShopIds) {
      try {
        const orders = await this.getStoreOrders(storeId, {
          start_created: startDate,
          end_created: endDate,
          page_size: 1,
          fields: 'total_count,total_fee',
        });
        results.push({
          storeId,
          totalCount: orders.total_count || 0,
          totalFee: orders.total_fee || 0,
        });
      } catch (err) {
        logger.warn(`获取门店 ${storeId} 销售汇总失败`, { error: err.message });
        results.push({ storeId, totalCount: 0, totalFee: 0 });
      }
    }
    return results;
  }

  /** 获取所有商品库存汇总 */
  async getAllGoodsInventorySummary() {
    const goodsList = await this.getGoodsList({ page_size: 200 });
    const items = goodsList.items || [];
    const itemIds = items.map(i => i.item_id);
    
    if (itemIds.length === 0) return [];
    
    const inventory = await this.getGoodsInventoryBatch(itemIds);
    return (inventory.items || []).map(item => ({
      itemId: item.item_id,
      title: item.title,
      totalStock: (item.skus || []).reduce((sum, sku) => sum + (sku.quantity || 0), 0),
      skus: item.skus,
    }));
  }
}

// 单例
const youzanClient = new YouzanAPIClient();

module.exports = { youzanClient, YouzanAPIClient };
