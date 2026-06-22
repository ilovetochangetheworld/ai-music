# AI 练歌房文档导航

本目录只维护当前产品所需的事实文档。阅读顺序与约束以仓库根目录的 [`AGENTS.md`](../../AGENTS.md) 为准。

## 当前主线

| 分类 | 文档 | 用途 | 谁在何时更新 |
| --- | --- | --- | --- |
| 产品 | [`product/AI_PRACTICE_ROOM_PRD.md`](product/AI_PRACTICE_ROOM_PRD.md) | 产品定位、用户旅程、范围与验收标准 | 产品范围或用户体验发生变化时，编码前更新 |
| 架构 | [`architecture/AI_PRACTICE_ROOM_TECH.md`](architecture/AI_PRACTICE_ROOM_TECH.md) | 数据流、评分边界、服务与隐私 | 契约、评分、服务边界变化时，编码前更新 |
| 部署 | [`architecture/DEPLOYMENT.md`](architecture/DEPLOYMENT.md) | Pages、VPS 与发布验证 | 部署拓扑、环境变量或运维步骤变化时更新 |
| 规划 | [`project/ROADMAP.md`](project/ROADMAP.md) | 里程碑、任务和依赖 | 新增、拆分或调整任务时更新 |
| 状态 | [`project/STATUS.md`](project/STATUS.md) | `main` 已合并能力 | 仅集成负责人在合并后更新 |
| 决策 | [`project/DECISIONS.md`](project/DECISIONS.md) | 跨模块且难以逆转的决策 | 出现冲突或重大取舍时，编码前记录 |
| 协作 | [`project/DOCUMENT_WORKFLOW.md`](project/DOCUMENT_WORKFLOW.md) | AI Coding 文档更新时机 | 协作流程变化时更新 |
| 任务 | [`project/TASK_TEMPLATE.md`](project/TASK_TEMPLATE.md) | 无 GitHub Issue 时的任务交接模板 | 开工认领时创建，开发中持续补充 |

## 历史归档

`archive/` 下是旧“人生原声机”和“AI 声友局”的方案，只用于追溯，不是当前产品事实来源。归档文档不得用于覆盖 PRD、架构、契约或现有测试。

## 文档规则

- 一类事实只保留一个权威位置，不在根目录新增零散方案文档。
- 主线说明使用简体中文；代码标识符、路径、命令和协议字段保留原文。
- 文档与代码在同一任务、同一分支、同一 PR 中更新。
- 未合并工作写入 Issue/PR 或 `project/handoffs/`，不得提前写入 `STATUS.md`。
- 失效内容移入 `archive/` 并在索引中说明，不保留真假难辨的并行版本。
