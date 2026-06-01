# StoreOperationAgent - 代理层

## 调度配置
```yaml
agent:
  name: StoreOperationAgent
  domain: store
  priority: 2
  schedule:
    inventory_sync: "*/5 * * * *"        # 每5分钟库存同步
    health_check: "0 */2 * * *"           # 每2小时巡检
    staff_schedule: "0 18 * * *"          # 每日18点次日排班
    review_monitor: "*/30 * * * *"        # 每30分钟评价监控
    menu_rotation: "0 9 * * 1"            # 周一9点酒单轮转
    weekend_prep: "0 14 * * 5"            # 周五14点周末准备
```

## OpenClaw 指令映射
| 指令模式 | 动作 | 示例 |
|----------|------|------|
| `store.inventory:sync` | 全渠道库存同步 | `store.inventory:sync` |
| `store.menu:rotate:<tap_id>` | 轮转酒款 | `store.menu:rotate:14` |
| `store.staff:schedule` | 生成排班表 | `store.staff:schedule` |
| `store.review:respond:<id>` | 回复评价 | `store.review:respond:1024` |
| `store.health:check` | 执行巡检 | `store.health:check` |

## Pipeline 参与
- **dailyOps**: 步骤1、3、5（库存同步/巡检/评价处理）
- **autoReplenish**: 步骤1（库存检查）
- **onlineToOffline**: 步骤6（到店准备）

## 输出格式
```json
{
  "agent": "StoreOperationAgent",
  "action": "health_check",
  "timestamp": "2025-06-01T14:00:00",
  "checklist": [
    {"item": "生啤系统温度", "status": "pass", "value": "4.2°C"},
    {"item": "CO2压力", "status": "pass", "value": "12psi"},
    {"item": "冷柜温度", "status": "warn", "value": "6.8°C", "threshold": "4°C"}
  ],
  "summary": "11项巡检: 10项通过, 1项预警"
}
```
