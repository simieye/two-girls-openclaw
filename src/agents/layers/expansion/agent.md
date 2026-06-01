# ExpansionAgent - 代理层

## 调度配置
```yaml
agent:
  name: ExpansionAgent
  domain: expansion
  priority: 5
  schedule:
    partner_sales_report: "0 9 * * 1"     # 周一合作门店销售
    site_scoring: "0 10 * * 1"            # 周一选址评分更新
    online_retail_report: "0 9 * * *"     # 每日即时零售报表
```

## OpenClaw 指令映射
| 指令模式 | 动作 |
|----------|------|
| `expansion:site:score:<address>` | 选址评分 |
| `expansion:partner:report` | 合作门店报告 |
| `expansion:retail:optimize` | 即时零售优化 |
| `expansion:city:priority` | 城市优先级 |
