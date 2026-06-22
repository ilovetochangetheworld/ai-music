# AGENTS.md

> **沟通语言（最高优先级）**：本项目所有 AI coding 协作对话**一律使用简体中文**——包括
> 需求澄清、方案讨论、代码解释、提交说明、PR 描述与交接文档。代码标识符、路径、命令等保持
> 原文；面向用户的回复与文档说明使用中文。无论用户以何种语言提问，均以中文回应。

## 使命

本仓库现在构建 **AI 练歌房**：一个移动优先、由陪练主导的唱歌练习产品。用户演唱，唯一的
陪练「小麦」负责聆听、录制、分析，并在演唱结束后给出回应。专业反馈必须有证据支撑、低压力。

当前产品**不包含** QQ 音乐、歌单管理、排行榜、声音克隆，或未经请求的实时纠错。遗留的
soundtrack 与长音频实验仅保留在 `/lab` 下。

## 事实来源（Sources of truth）

修改任何行为前，按以下顺序阅读：

1. `AGENTS.md`
2. `soundtrack-life-mvp/docs/product/AI_PRACTICE_ROOM_PRD.md`
3. `soundtrack-life-mvp/docs/architecture/AI_PRACTICE_ROOM_TECH.md`
4. `soundtrack-life-mvp/shared/schema/`
5. 实现代码与测试

若以上来源相互冲突，**停下来**并在 `docs/project/DECISIONS.md` 记录决策；不得擅自扩大范围。

文档总索引见 `soundtrack-life-mvp/docs/README.md`，具体更新规则见
`soundtrack-life-mvp/docs/project/DOCUMENT_WORKFLOW.md`。

## 文档工作流与更新时机

- **需求进入、编码之前**：用户旅程、产品范围或验收标准变化时先更新 PRD；任务拆分或依赖变化时
  更新 ROADMAP。
- **方案设计、编码之前**：路由、数据流、评分、隐私或服务边界变化时先更新技术架构；JSON/API
  契约必须先更新 Schema。跨模块且难以逆转的选择先写入 DECISIONS。
- **开工时**：认领 GitHub Issue；不可用时从 TASK_TEMPLATE 创建 `docs/project/handoffs/APR-*.md`，
  写明负责人、分支、允许修改模块、验收标准和预计同步的文档。
- **编码过程中**：行为、接口、命令或环境变量一旦变化，当场同步对应文档和 handoff，不依赖对话记忆
  留到任务末尾。
- **提交 PR 前**：确认代码、Schema、PRD/架构/部署说明一致，并在交接中记录测试证据、风险、
  未完成项及 base/head SHA。若无需改文档，PR 中必须说明原因。
- **合并后**：只有集成负责人更新 STATUS；分支中或计划中的能力不得提前写成已交付。
- **发布前后**：发布负责人更新 DEPLOYMENT、启动命令、环境变量和线上验证结果。
- **方向废弃时**：旧文档迁入 `docs/archive/` 并从主线索引移除，不保留两份并行事实源。

主线文档与协作说明使用简体中文；代码标识符、协议字段、路径和命令保留原文。不得在 `docs/`
根目录随意新增零散方案，新增文档前先确认现有权威文档无法承载该信息。

## 仓库结构

- `soundtrack-life-mvp/src/features/practice-room/`：当前在用的 Web 产品。
- `soundtrack-life-mvp/src/features/sing-room/`：过渡期音频运行时；应迁移而非复制。
- `soundtrack-life-mvp/shared/schema/`：语言无关的契约。
- `soundtrack-life-mvp/server/`：对外的 Node BFF。
- `soundtrack-life-mvp/services/analysis/`：内部 Python CPU 分析服务。
- `soundtrack-life-mvp/public/catalog/`：可部署的歌曲包与校验元数据。
- `soundtrack-life-mvp/tools/practice-song-builder/`：IDE 无关的曲库工具（生成 timeline/manifest/
  notes/audio）。歌曲打包的**单一源头**。
- `soundtrack-life-mvp/docs/project/`：路线图、已合并状态、决策与交接。

## 命令与门禁

在 `soundtrack-life-mvp/` 下运行：

```bash
npm run dev
npm run typecheck
npm run lint
npm run test
npm run build
npm run test:analysis
npm run catalog:validate
```

相关测试与 `npm run build` 未通过前，任务都不算完成。评分相关改动还需补充契约 fixture 与
Python 测试。

## 工具与技能（多 IDE 协作）

本项目**同时使用多个 IDE/智能体（CodeBuddy 与 Codex）**开发。为保持可移植：

- **可复用的工具与 SOP 放在仓库内，不放在任何 IDE 私有目录。** 曲库工具的权威位置：
  `soundtrack-life-mvp/tools/practice-song-builder/`（及其 `README.md`）。
- IDE 专属入口（如 CodeBuddy 的 `practice-song-builder` 技能，或 Codex 的提示词）必须是
  指向仓库工具的**薄指针**，绝不私自分叉一份逻辑。
- 项目进展、决策与交接放在 `soundtrack-life-mvp/docs/project/`，使每个智能体无论用哪个 IDE
  都读到同一份状态。
- 练习曲打包命令（在 `soundtrack-life-mvp/` 下运行）：
  ```bash
  npm run song:build  -- <song.json>   # 生成 timeline/manifest/notes(占位)/phrases + 登记 index.json
  npm run song:audio  -- <song.json>   # 生成 accompaniment/rescue-lead/harmony 三轨
  npm run song:notes  -- <vocal.wav> <timeline.json> <out.candidate.json>  # 参考旋律候选(待人工校正)
  ```
  完整 SOP 与不变量见 `tools/practice-song-builder/README.md`。

## 产品与评分约束

- 分数是确定性输出；LLM 可润色措辞，但**不得**计算或改动分数。
- 没有参考旋律就不得声称音准；没有麦克风音频的生理依据就不得声称呼吸生理指标。
- 当有效演唱覆盖低于 20%、噪声过大或置信度不足时，返回 `insufficient_data`，而非编造分数。
- 原始录音未经明确同意不得离开设备。服务端上传上限 25 MB，且 24 小时内过期。
- 修音（tuning）绝不覆盖原始录音，且不得克隆他人嗓音。
- 现有歌曲资产仅为原型，**不**构成商用授权的证明。

## 多智能体协作流程

- 一个 issue、一个任务 ID、一个分支、一个 PR。**绝不**直接推送到 `main`。
- Codex 分支：`codex/apr-<task-id>-<slug>`；其他智能体：`<agent>/apr-<task-id>-<slug>`。
- 编辑前先认领对应 GitHub issue。若 GitHub 不可用，按任务模板创建
  `docs/project/handoffs/APR-<task-id>.md`。
- 保留与本任务无关的改动文件。不得重排格式或改写任务边界之外的文件。
- 避免多个角色同时拥有同一模块。契约必须先于消费方合并。
- PR 交接需包含 base/head SHA、行为变更、已运行命令、证据、风险与未完成事项。
- `STATUS.md` 只描述已合并的 `main`，由集成负责人在合并后更新。

## 完成的定义（Definition of done）

- 满足验收标准，且不得把 mock 结果当作真实分析呈现。
- 公共契约与文档随代码一起更新。
- 测试覆盖成功、数据不足与失败三类路径。
- 在 390×844 下检查移动端表现，且麦克风被拒绝时有恢复路径。
- 不提交任何密钥、原始隐私录音、完整源歌曲、生成缓存或与任务无关的用户文件。
