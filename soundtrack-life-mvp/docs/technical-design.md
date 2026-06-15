# 技术方案

## 架构概览

```text
React Web
  |
  |-- Life Event Input
  |-- Long Audio Transcript Input
  |
API Layer
  |
  |-- LLM Orchestrator
  |-- Song Matcher
  |-- Transcript Analyzer
  |-- TTS Adapter
  |
Mock Data
  |
  |-- songs.json
  |-- user-profile.json
  |-- podcast-transcript.json
```

## 核心模块

### 1. Life Event Parser

职责：

- 把用户自然语言输入转成结构化生活片段。
- 识别时间、事件、情绪、场景、能量水平。

输出示例：

```json
{
  "title": "雨后慢慢亮起来",
  "summary": "从失落到恢复的一天",
  "moodPath": ["low", "soft", "hopeful"],
  "scenes": [
    {
      "id": "scene_1",
      "label": "雨中的低谷",
      "timeOfDay": "afternoon",
      "emotion": "失落",
      "energy": 25,
      "keywords": ["面试失败", "雨", "安静"],
      "musicIntent": "接住情绪，不要过度煽情"
    }
  ]
}
```

### 2. Song Matcher

MVP 阶段使用本地 mock 曲库。

匹配维度：

- mood：sad、calm、hopeful、energetic、romantic
- scene：commute、walk、work、night、run、sleep
- energy：0-100
- language：mandarin、cantonese、english、instrumental
- tags：citypop、rnb、folk、rock、lofi

推荐逻辑：

1. scene tag 命中优先
2. mood tag 命中
3. energy 距离最小
4. 用户偏好加权
5. 避免同一歌手连续出现

### 3. DJ Narration Generator

职责：

- 为每个场景生成 1 段 15-30 秒口播。
- 解释为什么这段配这些歌。
- 语气可以切换：温柔、朋友、深夜电台、轻松毒舌。

输出：

```json
{
  "opening": "今天这张原声带，不急着把你从低处拉起来。我们先让雨停一会儿。",
  "sceneNarrations": {
    "scene_1": "这一段先不急着振作，选几首低能量但不彻底坠落的歌，像有人在旁边安静坐着。"
  },
  "closing": "你没有立刻变好，但你已经从今天里面走出来了一点。"
}
```

### 4. Transcript Analyzer

职责：

- 对播客/有声书 transcript 切章节。
- 提取主题、争议点、人物、金句。
- 支持问题到时间片段的检索。

MVP 可以不用向量库，直接让 LLM 基于 transcript 返回相关片段。若 transcript 较长，可先分块摘要。

### 5. Audio Coach Q&A

输入：

```text
只听关于 AI 音乐版权风险的部分
```

输出：

```json
{
  "answer": "这期节目主要提到三个风险：训练数据授权、声音肖像权、平台分发标识。",
  "segments": [
    {
      "start": "12:30",
      "end": "18:45",
      "title": "训练数据是否获得授权",
      "reason": "这里集中讨论了 Suno/Udio 类产品的版权争议。"
    }
  ]
}
```

## API 草案

### `POST /api/life-soundtrack`

请求：

```json
{
  "text": "今天早上通勤很堵，上午做了重要汇报，晚上想散步。",
  "tone": "warm",
  "userPreference": {
    "languages": ["mandarin", "cantonese"],
    "avoid": ["too_sad"]
  }
}
```

响应：

```json
{
  "soundtrack": {},
  "recommendedTracks": [],
  "narration": {}
}
```

### `POST /api/audio-coach/analyze`

请求：

```json
{
  "title": "AI 音乐播客",
  "transcript": []
}
```

响应：

```json
{
  "chapters": [],
  "brief": "",
  "deepDive": [],
  "keywords": []
}
```

### `POST /api/audio-coach/ask`

请求：

```json
{
  "question": "只听版权风险部分",
  "transcriptId": "podcast_ai_music_001"
}
```

响应：

```json
{
  "answer": "",
  "segments": []
}
```

## 推荐目录结构

```text
src/
  app/
    page.tsx
    soundtrack/page.tsx
    audio-coach/page.tsx
  components/
  lib/
    llm.ts
    songMatcher.ts
    transcriptAnalyzer.ts
    tts.ts
  data/
    songs.json
    user-profile.json
    podcast-transcript.json
```

