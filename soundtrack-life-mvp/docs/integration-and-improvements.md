# 功能接入与产品改进路线

## 当前代码接入状态

现在的 MVP 已经具备真实功能接入的基础：

- `src/lib/llm.ts` 已支持兼容 OpenAI Chat Completions 的接口。
- `src/lib/lifeParser.ts` 已接入 LLM 优先、mock 降级的“生活轨迹 -> 今日原声带”链路。
- `src/lib/transcriptAnalyzer.ts` 已接入 LLM 优先、mock 降级的“长音频 -> 章节地图”链路。
- `src/lib/audioCoach.ts` 已接入 LLM 优先、mock 降级的“长音频追问 -> 推荐片段”链路。
- `src/lib/songMatcher.ts` 使用本地规则推荐歌曲，避免 LLM 编造曲库中不存在的歌。

因此，下一步不是重写架构，而是按优先级增强以下四块：

1. 接入真实 LLM 配置并验证输出稳定性。
2. 增强推荐解释与用户可控性。
3. 给长音频增加“片段播放感”和“问题建议”。
4. 打磨现场 demo 的差异化叙事。

## 快速接入真实 LLM

### 1. 配置环境变量

复制 `.env.example` 为 `.env`：

```bash
cp .env.example .env
```

填入：

```bash
VITE_LLM_BASE_URL=https://api.lkeap.cloud.tencent.com/plan/v3
VITE_LLM_API_KEY=your_api_key
VITE_LLM_MODEL=hy3-preview
```

注意：

- `VITE_LLM_BASE_URL` 需要是兼容 `/chat/completions` 的 base URL。
- 也可以直接填完整 `/chat/completions` URL，适配器会自动识别。
- 前端直连 API 只适合黑客松 demo，不适合生产环境。生产环境应改为后端代理，避免暴露密钥。

### 2. 验证路径

优先验证三个输入：

```text
今天面试失败了，下午下雨，回家的路上突然觉得很累。但我不想听太惨的歌，想要一点点被接住，然后慢慢恢复。
```

```text
今天早上通勤很堵，上午做了一个重要汇报，下午被老板夸了，晚上想一个人散步，不想太兴奋，想慢慢放松。
```

```text
只听关于 AI 音乐版权风险的部分。
```

验收标准：

- 生活轨迹能稳定输出 3-5 个场景。
- 每个场景都有明确 `emotion`、`energy`、`recommendedTags`、`djNarration`。
- 长音频问答能返回真实存在的时间片段。
- API 失败时页面仍能回到 mock 结果。

## 海外产品启发

### Spotify AI DJ / AI Playlist

Spotify AI DJ 已经支持用户用语音或文本提出播放请求，AI Playlist 也支持从自然语言 prompt 生成歌单，并能继续用“更开心一点”“更动感一点”等指令细化。

可借鉴到本项目：

- 在结果页增加“继续调音”输入框。
- 支持用户对当前原声带追问：`更粤语一点`、`别太 emo`、`提高能量`、`换成夜跑版`。
- 每次调整只改当前场景或当前歌单，不重新生成全部结果。

### NotebookLM Audio Overviews

NotebookLM 的关键不是摘要，而是把资料变成“可听的对话式内容”，并支持用户加入对话。

可借鉴到本项目：

- 长音频结果页加入“AI 双人导听稿”：一个主持人负责概括，一个朋友角色负责追问。
- 对播客/有声书生成三种模式：`速听`、`深挖`、`争议辩论`。
- 用户问问题时，不只返回答案，也返回“建议听哪几段”和“为什么这段值得听”。

### Google Lyria RealTime / Magenta RealTime

实时音乐模型的方向是“用户实时控制音乐流”，重点在可控性和连续变化。

可借鉴到本项目：

- 不必在 MVP 生成音乐，但可以加入“情绪旋钮”：能量、松弛度、怀旧度、陪伴感。
- 用户拖动旋钮后，重新匹配歌曲和 DJ 旁白。
- 这能让产品从一次性生成变成可交互编排。

## 建议新增的产品功能

### P0：继续调音

在 `SoundtrackPage` 底部或每个场景卡片中增加输入：

```text
对这张原声带说一句调整要求：更松弛一点 / 换成粤语 / 不要太伤感 / 更适合夜跑
```

实现方式：

- 先不用重新调用 LLM。
- 根据关键词改变 `MatchContext`：
  - `粤语` -> `languages: ['cantonese']`
  - `不要太伤感` -> 降低 sad/restrained 权重
  - `更有能量` -> energy + 20
  - `更安静` -> energy - 20，增加 calm/soft
- 再调用 `matchSongs` 替换推荐歌曲。

为什么重要：

- 它让 Demo 从“生成结果”变成“可对话产品”。
- 和 Spotify AI DJ 的请求式交互有明确对标。

### P0：曲库推荐理由升级

当前歌曲理由来自 `reasonSeeds[0]`，可以升级为：

```text
因为这一段的情绪是「失落」，但你的意图是「不彻底坠落」，所以选择一首低能量、克制但有温度的歌。
```

实现方式：

- 新增 `buildSongReason(scene, song)`。
- 不必调用 LLM，先用模板即可。

### P1：长音频“听点卡片”

章节地图里除了摘要，增加三类标签：

- `观点`
- `争议`
- `适合跳听`

实现方式：

- `TranscriptAnalysis.chapters` 可新增可选字段 `listenReason?: string`、`chapterType?: string`。
- LLM 有字段就展示，没有则本地根据 keywords/importance 推断。

### P1：长音频导听稿

生成一段 60-90 秒“导听开场”：

```text
如果你只有三分钟，这期最值得听的是 03:20 到 09:10，因为这里直接谈到了 AI 音乐版权归属。后半段更适合想了解平台分账的人。
```

实现方式：

- 基于 `brief + threeMinuteRoute + fifteenMinuteRoute` 模板生成。
- 先不用 TTS，文字展示即可。

### P1：今日原声分享卡增强

分享卡上显示：

- 今日标题
- 情绪路径
- 三首代表歌曲
- 一句“今日片尾字幕”

一句话文案：

```text
我把今天听成了《雨后慢慢亮起来》。
```

### P2：TTS 口播

最简单接法：

- 使用浏览器 `speechSynthesis` 读 `openingNarration` 和 `scene.djNarration`。
- 给每个场景加一个“播放 DJ 旁白”按钮。

注意：

- 浏览器中文语音效果依赖系统环境，不稳定。
- 黑客松现场可以把它作为加分项，不作为主链路。

## 推荐优先级

如果你现在想“接功能”，建议按这个顺序：

1. 配 `.env`，跑通真实 LLM。
2. 做“继续调音”。
3. 做 `buildSongReason(scene, song)`。
4. 给长音频加导听稿。
5. 最后再考虑 TTS。

## 评审表达升级

原 pitch：

```text
根据一天轨迹生成我的电影原声。
```

升级 pitch：

```text
人生原声机不是生成一首歌，而是生成一段会随你调整的私人音频导演体验。它理解你今天经历了什么，也理解一段长音频哪里值得听，把 QQ 音乐的曲库、长音频和 AI 编排能力连成一个新的入口。
```
