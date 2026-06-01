# FinanceIntelligenceAgent - 代理层

## 调度配置
```yaml
agent:
  name: FinanceIntelligenceAgent
  domain: finance
  priority: 4
  schedule:
    daily_reconcile: "0 2 * * *"          # 凌晨2点对账
    weekly_pl: "0 9 * * 1"                # 周一9点周P&L
    monthly_report: "0 10 1 * *"          # 每月1日10点月报
    cashflow_alert: "0 */12 * * *"        # 每12小时现金流预警
```

## OpenClaw 指令映射
| 指令模式 | 动作 |
|----------|------|
| `finance:reconcile:daily` | 每日对账 |
| `finance:report:pl` | 损益表 |
| `finance:cost:analyze` | 成本分析 |
| `finance:invoice:ocr` | 发票识别 |
| `finance:cashflow:forecast` | 现金流预测 |

## Pipeline 参与
- **dailyOps**: 步骤2（自动对账）
- **eventFullCycle**: 步骤8（活动对账）
- **autoReplenish**: 步骤4（预算预留）
