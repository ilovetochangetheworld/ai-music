# CODEBUDDY.md This file provides guidance to CodeBuddy when working with code in this repository.

## 项目现状

本仓库已落地为一个可运行的 **Vite + React + TypeScript** 单页应用（人生原声机 MVP，面向 QQ 音乐 AI 黑客松），同时保留完整的产品/技术设计文档。实现代码位于 `src/`，设计文档位于 `docs/`、`prompts/`、`samples/`。

修改业务逻辑前，务必先读 `docs/technical-design.md`（架构与 API 契约）和 `docs/data-model.md`（数据结构），它们与 `src/types.ts` 共同构成事实来源。

## 常用命令

```bash
npm install      # 安装依赖
npm run dev      # 本地开发 http://localhost:5173
npm run build    # tsc 类型检查 + vite 生产构建
npm run preview  # 预览生产构建产物
```

应用默认运行在 **MOCK 引擎**（无需密钥即可跑通完整演示）。接入真实 LLM 时复制 `.env.example` 为 `.env`，填入兼容 OpenAI Chat Completions 协议的 `VITE_LLM_BASE_URL` / `VITE_LLM_API_KEY`；调用失败会自动降级回 mock。

## 核心架构（落地目标）

整体是一条单向体验流水线，所有模块围绕它组织：

```
输入生活/长音频 -> AI 理解 -> 生成结构化 JSON -> 推荐/导航 -> 播放式展示 -> 分享
```

系统分三层：**React Web 前端** → **API 层（编排 + 业务逻辑）** → **Mock 数据**。前端有两条平行体验线，共用同一套“AI 理解 → 结构化 JSON → 可视化”的范式。

### 两条产品主线

1. **日轨 BGM（A 模式，P0）**：用户输入一天的经历，系统拆成 3-5 个带情绪/能量的场景，为每个场景推荐歌曲并生成 DJ 旁白，输出一张“今日原声带”和可分享卡片。
2. **长音频速听教练（B 模式，P1）**：粘贴播客/有声书 transcript，自动切章节、生成 3 分钟速听与 15 分钟精听路线，并支持自然语言追问（如“只听版权风险部分”）定位到时间片段。

### `src/lib` 中的核心模块（已实现）

`lib/` 下为纯函数/服务，每个都有 **LLM 调用 + mock fallback** 两条路径，`lib/llm.ts` 未配置密钥或超时(9s)即返回 `null` 触发降级：

- **lifeParser.ts**（`generateSoundtrack`）：自然语言 → `Soundtrack`（含 `LifeScene[]`）。LLM 优先，降级到本地情绪词典启发式（`BUCKETS` 关键词匹配 + 时间推断）。**歌曲推荐始终由本地 `songMatcher` 完成**，避免 LLM 编造不存在的歌。`emotionColor()` 提供情绪→配色映射。
- **songMatcher.ts**（`matchSongs`）：纯本地规则匹配，不调 LLM。优先级固定：scene 命中(×100) > mood 命中(×40) > energy 距离 > 语言偏好加权 > 避免同歌手连续出现。
- **transcriptAnalyzer.ts**（`analyzeTranscript` / `parsePastedTranscript`）：transcript 切章节 + 速听/精听路线，**不用向量库**，LLM 优先并降级到关键词词典启发式。
- **audioCoach.ts**（`askAudioCoach`）：基于 bigram 关键词重叠在 segments/chapters 上检索，返回片段。

模块产出的结果通过 `src/store.tsx`（React Context + sessionStorage）在路由间共享；`/share/:id` 依赖 sessionStorage 持久化。

### API 契约（设计稿，当前由前端 lib 实现）

`docs/technical-design.md` 定义了三个 HTTP 端点（`/api/life-soundtrack`、`/api/audio-coach/analyze`、`/api/audio-coach/ask`）。MVP 阶段**未起后端**，对应逻辑直接由上述 `src/lib/*` 客户端函数实现，请求/响应字段与契约保持一致。若后续加后端，把 lib 逻辑平移到这三个端点即可。

### 数据模型

`docs/data-model.md` 定义了 6 个核心结构，是前后端共享类型的来源：`Song`、`LifeScene`、`Soundtrack`、`TranscriptSegment`、`AudioChapter`，以及 mood 路径。新增字段应回写该文档保持一致。

## 关键工程约束（来自文档，务必遵守）

- **Mock-first / fallback 强制**：所有 LLM 调用都必须有 mock fallback；API 失败时回落到本地示例数据。演示需在**断网或 API 不稳定**时仍可完整跑通——这是评审硬指标，不可省略。
- **首页“示例按钮”不接 API 也能进结果页**：参见 `docs/build-checklist.md` 验收项。
- **LLM 输出用 JSON schema 约束 + fallback 示例**，避免输出不稳定破坏流程。
- **结果页要像真实音乐产品，不是 JSON 预览器**：情绪曲线、场景时间线、歌曲卡片、模拟播放器都是体验的一部分。
- **loading 不超过 10 秒**，需准备 2 组固定 demo 输入（见 `docs/build-checklist.md` 末尾）。

## Prompt 模板

`prompts/` 下是三个核心 LLM 提示词，与上述模块一一对应，修改 LLM 行为时改这里而非散落在代码中：

- `prompts/life-soundtrack.md` → Life Event Parser + Narration
- `prompts/audio-coach-analyze.md` → Transcript Analyzer
- `prompts/audio-coach-ask.md` → Audio Coach Q&A

## 优先级（来自 build-checklist）

- **P0**：首页 + 日轨 BGM 完整链路 + mock 曲库匹配 + 结果页 + 演示脚本
- **P1**：长音频章节化 + 问答 + 分享卡片
- **P2**：TTS + 真实播放器 + 用户历史偏好 + 海报下载

时间紧张时只做“最小可行链路”：输入 → LLM 输出 JSON → 本地曲库按 mood/scene/bpm 匹配 → 时间线+歌单+旁白 → 分享卡片。
