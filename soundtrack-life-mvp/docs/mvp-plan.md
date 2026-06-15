# MVP 计划

## 目标

用 2-3 天做出可点击、可演示、可讲清商业价值的 Web 原型。

MVP 不追求生产级推荐算法，而追求完整体验闭环：

```text
输入生活/长音频 -> AI 理解 -> 生成结构 -> 推荐/导航 -> 播放式展示 -> 分享
```

## 推荐技术栈

- 前端：Next.js / Vite + React
- 样式：Tailwind CSS 或普通 CSS
- LLM：任意可用对话模型 API
- TTS：浏览器 SpeechSynthesis 或云 TTS，可先降级为文字口播
- 音乐数据：本地 JSON mock
- 长音频数据：本地 transcript mock

## 信息架构

页面：

1. `/` 输入页
2. `/soundtrack` 今日原声结果页
3. `/audio-coach` 长音频导航结果页
4. `/share/:id` 分享卡片页，可选

组件：

- `TimelineInput`
- `MoodCurve`
- `SceneCard`
- `TrackRecommendation`
- `DJNarration`
- `AudioChapterMap`
- `AskAudioCoach`
- `SharePoster`

## Day 1：产品骨架

任务：

- 搭建 Web 项目
- 做首页双入口
- 准备 mock 曲库 `songs.json`
- 准备 mock 长音频转写 `podcast-transcript.json`
- 实现生活输入到结构化 JSON 的 LLM 调用
- 静态展示“今日原声带”

验收：

- 用户输入一段生活描述后，可以看到 3-5 个场景卡片。
- 每个场景包含标题、情绪、推荐歌曲和推荐理由。

## Day 2：核心体验

任务：

- 加入情绪曲线可视化
- 加入 AI DJ 旁白
- 做长音频章节化
- 做“问长音频”功能
- 增加播放器样式和模拟播放状态

验收：

- 可以演示“今天发生了什么 -> 生成 BGM 时间线”。
- 可以演示“粘贴长音频 -> 生成章节 -> 问某个问题 -> 跳到相关片段”。

## Day 3：演示打磨

任务：

- 做分享卡片
- 准备 2 组固定 demo 数据
- 增加 loading / empty / error 状态
- 优化文案和视觉
- 准备 3 分钟 pitch

验收：

- 断网或 API 不稳定时，也能用 mock 模式完成演示。
- 评委能在 30 秒内理解产品核心。

## 最小可行链路

如果时间很少，只做这条：

1. 用户输入今日经历
2. LLM 输出 JSON
3. 本地曲库按 mood/scene/bpm tags 匹配
4. 展示时间线 + 歌单 + DJ 旁白
5. 一键生成分享卡片

长音频功能可以作为第二 tab，用 mock transcript 做演示。

## 风险与降级

- LLM 输出不稳定：使用 JSON schema + fallback 示例。
- 曲库推荐不准：用 mock 曲库手工标注 mood、scene、energy。
- TTS 效果不好：先用 DJ 文案 + 播放器 UI 表达。
- 长音频没有真实音频：用 transcript + 时间戳模拟。
- 两个方向太散：统一包装为“人生原声机”的两个能力。

## 评委演示路径

1. 输入一句强情绪生活描述。
2. 展示 AI 生成的今日标题和情绪曲线。
3. 点击某个场景，播放 DJ 旁白。
4. 展示歌曲推荐理由。
5. 切到长音频，问“只听版权风险部分”。
6. 最后展示分享卡片。

