# EventExecutionAgent - 代理层

## 调度配置
```yaml
agent:
  name: EventExecutionAgent
  domain: event
  priority: 3
  schedule:
    event_planning: "0 10 * * 1"         # 周一10点活动规划
    ticket_monitor: "0 */6 * * *"        # 每6小时票务监控
    promotion_push: "0 14 * * *"         # 每日14点活动推广
    weekly_event_report: "0 9 * * 2"     # 周二9点活动周报
```

## OpenClaw 指令映射
| 指令模式 | 动作 | 示例 |
|----------|------|------|
| `event:plan:<type>` | 活动策划 | `event:plan:beer_festival` |
| `event:ticket:open` | 开启售票 | `event:ticket:open:early_bird` |
| `event:promote:<channel>` | 活动推广 | `event:promote:all` |
| `event:execute:checklist` | 执行清单 | `event:execute:checklist` |
| `event:report:roi` | ROI报告 | `event:report:roi` |

## Pipeline 参与
- **eventFullCycle**: 全部10步骤（主导Pipeline）

## 输出格式
```json
{
  "agent": "EventExecutionAgent",
  "action": "event_plan",
  "event": {
    "name": "两女孩夏日啤酒节",
    "date": "2025-07-15",
    "venue": "SM城市广场户外",
    "expected_attendance": 500,
    "budget": 150000,
    "ticket_price": {"early_bird": 99, "regular": 128, "vip": 288}
  },
  "checklist_total": 45,
  "checklist_completed": 0,
  "timeline": "D-45 → D-Day"
}
```
