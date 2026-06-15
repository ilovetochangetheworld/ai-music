# 数据与接口设计

## Song

```json
{
  "id": "song_001",
  "title": "慢慢喜欢你",
  "artist": "莫文蔚",
  "language": "mandarin",
  "mood": ["warm", "soft", "romantic"],
  "scene": ["walk", "night"],
  "energy": 42,
  "bpm": 78,
  "tags": ["pop", "city", "gentle"],
  "reasonSeeds": [
    "旋律温柔，适合夜晚散步",
    "情绪轻，但不空"
  ],
  "previewUrl": ""
}
```

## LifeScene

```json
{
  "id": "scene_1",
  "label": "被城市卡住的早晨",
  "timeOfDay": "morning",
  "sourceEvent": "早上通勤很堵",
  "emotion": "烦躁",
  "energy": 35,
  "musicIntent": "降低焦躁，让节奏慢慢稳定",
  "visualColor": "#7A8CA5",
  "recommendedSongIds": ["song_001", "song_002"]
}
```

## Soundtrack

```json
{
  "id": "soundtrack_001",
  "title": "把今天慢慢放下",
  "subtitle": "一张从堵车到夜晚散步的私人原声带",
  "date": "2026-06-15",
  "moodPath": [
    { "label": "烦躁", "energy": 35 },
    { "label": "紧张", "energy": 65 },
    { "label": "轻松", "energy": 50 },
    { "label": "平静", "energy": 30 }
  ],
  "scenes": [],
  "narration": {}
}
```

## TranscriptSegment

```json
{
  "id": "seg_001",
  "start": "00:00",
  "end": "02:35",
  "speaker": "host",
  "text": "今天我们聊 AI 音乐产品为什么突然变得这么火。",
  "topics": ["AI 音乐", "产品趋势"]
}
```

## AudioChapter

```json
{
  "id": "chapter_1",
  "start": "00:00",
  "end": "08:20",
  "title": "AI 音乐从玩具变成产品",
  "summary": "嘉宾讨论了 Suno、Udio 等工具如何降低创作门槛。",
  "keywords": ["Suno", "Udio", "创作门槛"],
  "importance": 85
}
```

