# HRTalentAgent - 代理层

## 调度配置
```yaml
agent:
  name: HRTalentAgent
  domain: hr
  priority: 5
  schedule:
    schedule_generate: "0 18 * * *"       # 每日18点次日排班
    attendance_sync: "0 */2 * * *"         # 每2小时考勤同步
    payroll_prepare: "0 10 25 * *"         # 每月25日薪资计算
    efficiency_report: "0 9 * * 1"         # 周一人效报告
```

## OpenClaw 指令映射
| 指令模式 | 动作 |
|----------|------|
| `hr:schedule:generate` | 生成排班 |
| `hr:attendance:report` | 考勤报表 |
| `hr:payroll:calculate` | 薪资计算 |
| `hr:efficiency:analyze` | 人效分析 |
| `hr:event:staff` | 活动人员调度 |

## Pipeline 参与
- **eventFullCycle**: 步骤5（活动人员调度）
