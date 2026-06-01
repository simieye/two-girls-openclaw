# TrafficAcquisitionAgent - 代理层

## 调度配置
```yaml
agent:
  name: TrafficAcquisitionAgent
  domain: marketing
  priority: 2
  schedule:
    content_publish: "0 10 * * *"        # 每日10点自动发布
    engagement_monitor: "*/30 * * * *"    # 每30分钟监控互动
    coupon_distribute: "0 12 * * *"       # 每日12点发放优惠券
    campaign_report: "0 18 * * *"         # 每日18点营销日报
    weekly_roi: "0 9 * * 1"               # 周一9点周ROI报告
```

## OpenClaw 指令映射
| 指令模式 | 动作 | 示例 |
|----------|------|------|
| `marketing.campaign:launch:<type>:<channel>` | 发起营销活动 | `marketing.campaign:launch:flash_sale:youzan` |
| `marketing.coupon:create:<type>:<count>` | 创建优惠券 | `marketing.coupon:create:welcome:500` |
| `marketing.content:generate:<platform>:<topic>` | 生成内容 | `marketing.content:generate:xiaohongshu:new_beer` |
| `marketing.kol:contact:<tier>` | 联系KOL | `marketing.kol:contact:top` |
| `marketing.ad:optimize:<channel>` | 优化广告 | `marketing.ad:optimize:douyin` |

## Pipeline 参与
- **onlineToOffline**: 步骤1-4（内容生成→发布→互动监控→线索捕获）
- **eventFullCycle**: 步骤2-3（物料创建→售票开启）
- **newProductLaunch**: 步骤5-6（活动发布→会员通知）
- **dailyOps**: 步骤6（定时内容发布）

## 输出格式
```json
{
  "agent": "TrafficAcquisitionAgent",
  "action": "content_generate",
  "platform": "xiaohongshu",
  "content": {
    "title": "...",
    "body": "...",
    "images": ["url1", "url2"],
    "hashtags": ["#两女孩精酿", "#厦门精酿"],
    "publish_time": "2025-06-01T20:00:00"
  },
  "metrics": {
    "estimated_reach": 5000,
    "estimated_engagement": 500,
    "expected_conversion": 25
  }
}
```
