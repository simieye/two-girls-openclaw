# MemberGrowthAgent - 代理层

## 调度配置
```yaml
agent:
  name: MemberGrowthAgent
  domain: member
  priority: 3
  schedule:
    rfm_analysis: "0 9 * * 1"            # 周一9点RFM分析
    churn_check: "0 11 * * *"            # 每日11点流失检查
    birthday_coupon: "0 8 * * *"         # 每日8点生日券发放
    member_day: "0 10 15 * *"            # 每月15日会员日
    welcome_sequence: "*/30 * * * *"      # 每30分钟新会员欢迎
```

## OpenClaw 指令映射
| 指令模式 | 动作 | 示例 |
|----------|------|------|
| `member.acquire:<channel>` | 渠道获客分析 | `member.acquire:all` |
| `member.engage:message:<segment>` | 会员触达 | `member.engage:message:vip` |
| `member.analyze:rfm` | RFM分析 | `member.analyze:rfm` |
| `member.churn:prevent` | 流失预防 | `member.churn:prevent` |
| `member.referral:campaign` | 裂变活动 | `member.referral:campaign` |

## Pipeline 参与
- **onlineToOffline**: 步骤4（线索捕获→会员转化）
- **eventFullCycle**: 步骤10（活动参与者→会员转化）
- **dailyOps**: 步骤4（流失检查）

## 输出格式
```json
{
  "agent": "MemberGrowthAgent",
  "action": "rfm_analysis",
  "timestamp": "2025-06-01T09:00:00",
  "summary": {
    "total_members": 5200,
    "active_rate": "40%",
    "churn_risk": "15%",
    "avg_ltv": 850
  },
  "segments": [
    {"name": "高价值忠诚", "count": 624, "trend": "+5%"},
    {"name": "流失风险", "count": 780, "trend": "+2%"}
  ],
  "actions": [
    "向624名高价值会员推送黑卡升级邀请",
    "向780名流失风险会员发放回归礼包"
  ]
}
```
