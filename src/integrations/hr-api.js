/**
 * HR 系统 API 客户端
 * 对接飞书/钉钉等HR系统，实现智能排班、考勤管理、员工画像
 */

const axios = require('axios');
const { logger } = require('../utils/logger');
const config = require('../config');

class HRAPIClient {
  constructor() {
    this.baseURL = config.hr.apiBase;
    this.apiKey = config.hr.apiKey;
    this.systemType = config.hr.systemType;

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
        logger.error('HR系统API请求失败', {
          url: err.config?.url,
          status: err.response?.status,
          error: err.message,
        });
        throw err;
      }
    );
  }

  // ==========================================
  // 员工管理
  // ==========================================

  /** 获取员工列表 */
  async getEmployeeList(params = {}) {
    return this.http.get('/employees', { params });
  }

  /** 获取员工详情 */
  async getEmployeeDetail(employeeId) {
    return this.http.get(`/employees/${employeeId}`);
  }

  /** 按门店获取员工 */
  async getStoreEmployees(storeId) {
    return this.http.get('/employees/by-store', { params: { store_id: storeId } });
  }

  // ==========================================
  // 排班管理
  // ==========================================

  /** 获取当前排班 */
  async getCurrentSchedule(storeId) {
    return this.http.get(`/schedules/current`, { params: { store_id: storeId } });
  }

  /** 创建排班 */
  async createSchedule(storeId, shifts) {
    return this.http.post('/schedules', {
      store_id: storeId,
      shifts,
    });
  }

  /** 智能排班 - 基于销售预测和客流 */
  async smartSchedule(storeId, weekStart, options = {}) {
    return this.http.post('/schedules/smart', {
      store_id: storeId,
      week_start: weekStart,
      sales_forecast: options.salesForecast,
      traffic_forecast: options.trafficForecast,
      employee_preferences: options.employeePreferences,
      constraints: options.constraints || {
        max_hours_per_week: 40,
        min_rest_hours: 11,
        min_staff_per_shift: 2,
      },
    });
  }

  /** 发布排班 */
  async publishSchedule(scheduleId) {
    return this.http.post(`/schedules/${scheduleId}/publish`);
  }

  // ==========================================
  // 考勤管理
  // ==========================================

  /** 获取考勤记录 */
  async getAttendance(storeId, startDate, endDate) {
    return this.http.get('/attendance', {
      params: { store_id: storeId, start: startDate, end: endDate },
    });
  }

  /** 考勤异常预警 */
  async getAttendanceAlerts(startDate, endDate) {
    return this.http.get('/attendance/alerts', {
      params: { start: startDate, end: endDate },
    });
  }

  /** 打卡记录 */
  async getClockInRecords(storeId, date) {
    return this.http.get('/attendance/clock-in', {
      params: { store_id: storeId, date },
    });
  }

  // ==========================================
  // 绩效与薪资
  // ==========================================

  /** 获取绩效数据 */
  async getPerformance(employeeId, period) {
    return this.http.get(`/performance/${employeeId}`, { params: { period } });
  }

  /** 门店人效分析 */
  async getStoreEfficiency(storeId, startDate, endDate) {
    return this.http.get(`/efficiency/store/${storeId}`, {
      params: { start: startDate, end: endDate },
    });
  }

  /** 薪资计算 */
  async calculatePayroll(storeId, period) {
    return this.http.post('/payroll/calculate', {
      store_id: storeId,
      period,
    });
  }

  // ==========================================
  // 招聘与培训
  // ==========================================

  /** 发布招聘需求 */
  async createJobPosting(posting) {
    return this.http.post('/recruitment/jobs', posting);
  }

  /** 培训记录 */
  async getTrainingRecords(storeId) {
    return this.http.get('/training/records', { params: { store_id: storeId } });
  }

  // ==========================================
  // 数据分析
  // ==========================================

  /** 人力成本分析 */
  async getLaborCostAnalysis(storeId, period) {
    return this.http.get('/analytics/labor-cost', {
      params: { store_id: storeId, period },
    });
  }

  /** 门店人效排名 */
  async getStoreEfficiencyRanking(startDate, endDate) {
    return this.http.get('/analytics/store-ranking', {
      params: { start: startDate, end: endDate },
    });
  }
}

const hrClient = new HRAPIClient();
module.exports = { hrClient, HRAPIClient };
