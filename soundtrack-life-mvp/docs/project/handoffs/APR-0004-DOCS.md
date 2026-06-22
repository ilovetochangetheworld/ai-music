# APR-0004 任务交接——文档结构与 AI Coding 更新规范

- 目标：整理当前文档结构，将主线文档中文化，并明确 AI Coding 各阶段的文档更新时机。
- 负责人 / 智能体：Codex
- Base SHA / 分支：`9966f451105bf18589556b3b0868c5f2faad113c` / `codex/apr-0004-docs-governance`
- 依赖：根 `AGENTS.md`、当前 PRD、技术架构和项目状态文件。
- 允许修改的模块：`AGENTS.md`、`soundtrack-life-mvp/docs/`、文档入口和旧 Lab 文档引用。
- 验收标准：主线文档有中文导航；旧产品文档归档；协作规范明确各阶段更新对象、责任人与门禁；仓库无失效旧路径引用。
- 需同步的文档：本任务即文档治理，不更新 `STATUS.md` 的能力内容。
- 已运行命令：`git diff --check`、`npm run typecheck`、`npm run lint`、`npm run build`、旧路径 `rg` 扫描。
- 验证证据：类型检查、lint 和生产构建通过；主线文档无旧英文段落标题；代码与文档中无已迁移旧路径引用。
- 风险 / 未完成项：归档内容保留历史原文，可能包含已失效接口，只允许用于追溯。
- Head SHA / PR：提交后由集成负责人填写 / 待创建。
