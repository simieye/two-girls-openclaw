/**
 * 集成层统一导出
 * 将所有外部API客户端集中管理
 */

const { youzanClient } = require('./youzan-api');
const { financeClient } = require('./finance-api');
const { hrClient } = require('./hr-api');
const { erpClient } = require('./erp-api');

// 数据桥接 - 实现跨系统数据互联互通
class DataBridge {
  constructor() {
    this.youzan = youzanClient;
    this.finance = financeClient;
    this.hr = hrClient;
    this.erp = erpClient;
  }

  /**
   * 有赞订单 → 财务系统
   * 将门店销售数据同步到财务系统进行对账
   */
  async syncOrdersToFinance(startDate, endDate) {
    const youzanOrders = await this.youzan.getOrderList({
      startCreated: startDate,
      endCreated: endDate,
      pageSize: 200,
    });

    const payments = (youzanOrders.trades || []).map(order => ({
      trade_id: order.tid,
      amount: order.payment,
      store_id: order.offline_id,
      pay_time: order.pay_time,
      payment_type: order.pay_type,
    }));

    return this.finance.importYouzanPayments(payments);
  }

  /**
   * 有赞库存 → ERP供应链
   * 将门店库存数据同步到ERP系统
   */
  async syncInventoryToERP() {
    const inventory = await this.youzan.getAllGoodsInventorySummary();
    return this.erp.syncGoodsToYouzan(inventory);
  }

  /**
   * ERP采购 → 有赞商品
   * ERP采购完成后的商品自动上架到有赞
   */
  async syncProcurementToYouzan(purchaseOrderId) {
    const order = await this.erp.http.get(`/purchase-orders/${purchaseOrderId}`);
    const items = (order.items || []).map(item => ({
      item_id: item.item_id,
      sku_id: item.sku_id,
      quantity: item.received_quantity,
    }));
    return this.erp.syncGoodsToYouzan(items);
  }

  /**
   * HR排班 → 门店运营
   * 排班数据与门店销售数据关联分析
   */
  async syncScheduleToStoreAnalytics(storeId, weekStart) {
    const [schedule, salesData, traffic] = await Promise.all([
      this.hr.getCurrentSchedule(storeId),
      this.youzan.getStoreOrders(storeId, {
        startCreated: weekStart,
        endCreated: new Date(new Date(weekStart).getTime() + 7 * 86400000).toISOString(),
        fields: 'total_count,total_fee',
      }),
      this.youzan.getStoreOrders(storeId, {
        startCreated: weekStart,
        fields: 'total_count',
      }),
    ]);

    return {
      storeId,
      weekStart,
      schedule: schedule.shifts,
      salesData: salesData.total_fee,
      orderCount: salesData.total_count,
      efficiency: salesData.total_fee / (schedule.shifts?.length || 1),
    };
  }

  /**
   * 全链路数据健康检查
   */
  async healthCheck() {
    const results = {};
    try {
      results.youzan = await this.youzan.getOrderList({ pageSize: 1 });
      results.finance = await this.finance.getProfitLossStatement('current');
      results.hr = await this.hr.getEmployeeList({ pageSize: 1 });
      results.erp = await this.erp.getInventorySnapshot();
      results.status = 'healthy';
    } catch (err) {
      results.status = 'degraded';
      results.error = err.message;
    }
    return results;
  }
}

const dataBridge = new DataBridge();

module.exports = {
  youzanClient,
  financeClient,
  hrClient,
  erpClient,
  dataBridge,
};
