# SupplyChainAgent - 代理层

## 调度配置
```yaml
agent:
  name: SupplyChainAgent
  domain: supply
  priority: 3
  schedule:
    inventory_check: "*/30 * * * *"       # 每30分钟库存检查
    batch_monitor: "0 */4 * * *"          # 每4小时批次监控
    bbq_order: "0 6 * * *"               # 每日6点BBQ食材订购
    weekly_replenish: "0 9 * * 3"         # 周三9点周补货计划
    quality_report: "0 10 * * 1"          # 周一10点品质周报
```

## OpenClaw 指令映射
| 指令模式 | 动作 | 示例 |
|----------|------|------|
| `supply.purchase:create:<item>` | 创建采购单 | `supply.purchase:create:malt` |
| `supply.delivery:schedule` | 配送调度 | `supply.delivery:schedule` |
| `supply.brew:start:<batch_id>` | 开始酿造 | `supply.brew:start:B20250601` |
| `supply.quality:check:<batch_id>` | 品质检测 | `supply.quality:check:B20250501` |
| `supply.inventory:report` | 库存报告 | `supply.inventory:report` |

## Pipeline 参与
- **autoReplenish**: 全部4步骤
- **newProductLaunch**: 步骤1-3（酿造完成/入库/上架）
- **eventFullCycle**: 步骤4（活动备货）
- **dailyOps**: 步骤1（库存同步）

## 输出格式
```json
{
  "agent": "SupplyChainAgent",
  "action": "inventory_report",
  "timestamp": "2025-06-01T09:00:00",
  "summary": {
    "total_sku": 45,
    "low_stock": 3,
    "out_of_stock": 0,
    "expiring_soon": 2
  },
  "alerts": [
    {"item": "Galaxy酒花", "stock": 5, "threshold": 6, "action": "建议采购10kg"},
    {"item": "牛肉", "stock": 50, "daily_usage": 20, "action": "建议明日补货30kg"}
  ]
}
```
