# SalesGrowthAgent - 代理层

## 调度配置
```yaml
agent:
  name: SalesGrowthAgent
  domain: sales
  priority: 1  # 最高优先级
  schedule:
    daily_report: "30 2 * * *"            # 凌晨2:30日报
    weekly_report: "0 9 * * 1"            # 周一9点周报
    monthly_report: "0 10 1 * *"          # 每月1日10点月报
    forecast_update: "0 */6 * * *"        # 每6小时预测更新
    kpi_alert: "*/15 * * * *"             # 每15分钟KPI预警
```

## OpenClaw 指令映射
| 指令模式 | 动作 | 示例 |
|----------|------|------|
| `sales:report:daily` | 日报 | `sales:report:daily` |
| `sales:forecast:next_week` | 预测 | `sales:forecast:next_week` |
| `sales.target:set:<amount>:<period>` | 目标 | `sales.target:set:500000:monthly` |
| `sales.funnel:analyze` | 漏斗分析 | `sales.funnel:analyze` |
| `sales.top10:report` | 热销排行 | `sales.top10:report` |

## Pipeline 参与
- **dailyOps**: 步骤4（日报）
- **onlineToOffline**: 步骤7（转化追踪）
- **eventFullCycle**: 步骤7（活动收入记录）
- **newProductLaunch**: 步骤7（新品表现追踪）

## 三情景预测模型
| 情景 | 概率 | GMV(月) | 假设 |
|------|------|---------|------|
| 乐观 | 25% | ¥580,000 | 新品大爆+活动成功+天气好 |
| 基准 | 55% | ¥500,000 | 按当前趋势线性增长 |
| 悲观 | 20% | ¥420,000 | 雨季+竞品活动+经济下行 |
