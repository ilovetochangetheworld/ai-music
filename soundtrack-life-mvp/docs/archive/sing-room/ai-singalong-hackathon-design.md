# AI 声友局：黑客松产品与音乐技术方案

> 调研日期：2026-06-18  
> 适用仓库：`soundtrack-life-mvp`  
> 结论：以“实时陪唱与救场”为唯一主体验，复用现有歌单、LLM、分享页能力；不要在比赛阶段做任意歌曲实时歌声生成。

## 1. 一句话方案

**从我的歌单挑一首，AI 在唱前暖场、唱中接住停顿、唱后记住高光，让一个人的演唱也有回应。**

它组合了三类能力，但只呈现一条用户链路：

- 当前项目：歌单理解、情绪编排、LLM 适配、分享卡。
- AI 声友局 PRD：唱中陪伴、停唱救场、角色化互动。
- SingPod：非评判式反馈、具体高光、可分享的结果表达。

## 2. 为什么这样改

当前项目已经有 Vite + React + TypeScript、Framer Motion、QQ 音乐歌单接入、LLM/mock 双路径和分享页，但“人生原声带 + 长音频教练 + 歌单管家”在三分钟路演里偏散，也没有一个能被现场立即感知的 AI 音乐瞬间。

声友局最强的演示瞬间非常明确：

> 用户在副歌故意停下，AI 声友从同一拍点自然接唱；用户重新开口，AI 在短句末尾淡出。

这件事同时展示了感知、音乐理解、实时决策和情绪价值，比再增加一个生成页面更有记忆点。

## 3. 产品定位

### 3.1 核心用户

- 喜欢唱歌但不敢进入真人歌房的人。
- 一个人唱容易中途退出、忘词或怕高音的人。
- 希望被回应，但不想被冷冰冰评分的人。

### 3.2 核心承诺

AI 不是裁判，也不假装真人朋友。它是一个透明、可关闭、懂音乐节点的数字歌友：

- 该安静时安静。
- 唱不上去时接一下。
- 唱回来后把主角还给用户。
- 唱完只基于真实事件给具体鼓励。

### 3.3 与 SingPod 的关系

[SingPod](https://singpod.com/) 的 VoxScore 强项是上传演唱后，从音准、节奏、气息、情绪和稳定性给出非评判式反馈，并鼓励进步与分享。声友局应借鉴它的“具体但温和”和结果卡表达，但把价值前移到演唱过程：SingPod 更像唱后观众，声友局必须在唱中真正接住用户。

## 4. 黑客松 MVP

### 4.1 必须完成

1. 一个“热闹朋友局”。
2. 两首固定 Demo 歌，每首 60 至 90 秒精剪版。
3. 小麦（主持）、阿和（陪唱）、大声（听众）三个角色。
4. 麦克风采集、环境校准、演唱/停唱检测。
5. 副歌陪唱、自动救场和“帮我接”手动救场。
6. AI 声轨随用户重新开口自然淡出。
7. 基于事件日志的唱后高光与声友留言。
8. 断网、LLM 失败时仍能完整演示。

### 4.2 明确不做

- 任意歌曲实时生成歌声。
- 实时三声部和声。
- 明星音色克隆或未经授权的声音模仿。
- 完整音准评分和专业声乐诊断。
- 真人多人房、账号体系、作品公开发布。
- 自动分析任意歌曲结构。

## 5. 完整体验

### 5.1 唱前：从歌单到包厢

复用现有 QQ 音乐登录与歌单管家作为故事入口，但 Demo 的真正可唱歌曲只提供两首已准备资产：

```text
我的歌单
  -> AI 推荐“今晚适合开口的一首”
  -> 选择互动强度：安静 / 适中 / 热闹
  -> 3 秒环境校准
  -> 小麦暖场并倒数
```

若 QQ 音乐接口不稳定，直接使用本地 mock 歌单，不影响主链路。

### 5.2 唱中：唯一主舞台

页面只保留演唱需要的信息：

- 当前歌词和下一句歌词。
- 歌曲进度与当前段落。
- 三个角色的状态，不使用连续聊天流。
- `帮我接`、互动强度、暂停三个操作。
- 麦克风是否检测到人声的轻量指示。

关键体验：

```text
前奏：小麦只说一句暖场
主歌：角色保持安静
副歌：阿和低音量加入预制陪唱轨
用户停唱：阿和从当前对齐位置淡入
用户恢复：阿和在当前短句/拍点后淡出
高光结束：大声触发一次掌声和短气泡
```

### 5.3 唱后：勇气回忆，不做总分

借鉴 SingPod 的具体反馈，但将指标改为陪伴目标：

- **完成度**：用户实际参与的可唱时长比例。
- **开口状态**：前半段与后半段的参与度变化。
- **接回次数**：AI 救场后用户成功重新开口的次数。
- **今日高光**：完整唱完且状态最稳定的一个片段。
- **声友留言**：只复述可验证事实，不编造音准或情绪诊断。

示例：

> 第二段副歌你完整接了回来。阿和帮你托住一次，但后面 18 秒都是你自己唱完的。

## 6. 技术架构

```text
React UI
  |
  +-- Room configuration / lyrics / character animation
  |
Web Audio runtime (唯一音乐时钟)
  |
  +-- accompaniment AudioBufferSource -> GainNode
  +-- AI vocal AudioBufferSource      -> GainNode
  +-- crowd / applause                -> GainNode
  +-- microphone MediaStreamSource    -> analyser
  |
Singing detector
  +-- calibrated RMS / noise floor
  +-- pitch clarity + pitch track
  +-- optional Silero VAD confidence
  |
Timeline + event engine
  +-- section / lyric / beat markers
  +-- rescue policy / cooldown / interaction budget
  +-- deterministic event log
  |
Post-song analyzer
  +-- factual metrics and highlight selection
  +-- LLM wording (optional, mock fallback)
```

### 6.1 最重要的架构原则

**LLM 不进入实时音频控制回路。**

救场是否触发、声轨何时淡入淡出必须由本地事件引擎决定。LLM 只负责：

- 开唱前一句暖场。
- 唱完后的表达润色。
- 下一首推荐理由。

这样不会让网络延迟决定音乐节拍，也能保证断网 Demo。

## 7. 音乐资产准备

每首 Demo 歌必须从同一个时间零点导出以下文件：

```text
public/audio/song-a/
  accompaniment.wav
  ai-vocal.wav
  applause-short.wav
  timeline.json
```

其中 `accompaniment.wav` 和 `ai-vocal.wav`：

- 采样率、长度、前置静音完全一致。
- 从歌曲绝对时间 0 同时启动，平时只把 AI 声轨音量设为 0。
- 不在救场时临时 seek 或新建不对齐的播放器。
- AI 声轨使用团队成员、授权歌声或无歌词哼唱，不使用明星克隆。

`timeline.json` 建议结构：

```json
{
  "duration": 78.4,
  "bpm": 76,
  "sections": [
    { "type": "intro", "start": 0, "end": 8, "vocalExpected": false },
    { "type": "verse", "start": 8, "end": 34, "vocalExpected": true },
    { "type": "chorus", "start": 34, "end": 61, "vocalExpected": true }
  ],
  "lines": [
    {
      "id": "line-12",
      "start": 37.2,
      "end": 41.8,
      "text": "示例歌词",
      "rescuable": true,
      "highlight": false
    }
  ],
  "beats": [34.0, 34.79, 35.58]
}
```

比赛前手工标注两首歌，比引入自动切段模型更稳定。自动分析可以作为路线图，不应成为现场依赖。

## 8. 实时演唱检测

### 8.1 先做环境校准

进入房间后采集 3 秒环境音，计算噪声 RMS 的中位数和高分位数，得到动态阈值。固定阈值在不同电脑、麦克风和场地会非常脆弱。

建议每 40 至 50ms 计算：

- RMS / dBFS。
- 音高与 clarity。
- 可选 VAD probability。

MVP 的 `isSinging` 可采用组合判断：

```text
energyActive = db > calibratedNoiseFloor + 10dB
pitched      = pitchClarity > 0.72 and pitch between 70Hz and 1100Hz
isSinging    = energyActive and (pitched or vadProbability > 0.65)
```

不要只依赖普通 VAD：它主要面向语音，唱歌、长音和气声可能被漏检。对 K 歌场景，RMS + 音高置信度往往比单一语音 VAD 更可靠。

### 8.2 救场触发条件

```text
当前处于 vocalExpected 段落
AND 当前歌词行 rescuable = true
AND 用户此前已经开口（排除只听模式）
AND 连续未检测到演唱 > 1.2s
AND 距离上次救场 > 4s
AND 当前不处于换气保护窗/句尾
```

在 1.2 秒进入 `rescue_armed`，到 1.6 秒仍静音才淡入；这给换气和短停顿留出空间。

### 8.3 用户恢复后的退出

- 连续检测到演唱 250 至 350ms，标记 `USER_RESUMED`。
- 找到当前歌词行结束或下一个拍点。
- AI 声轨使用 `GainNode.linearRampToValueAtTime` 在 180 至 300ms 淡出。
- 不立即硬切，否则现场听感会明显穿帮。

### 8.4 耳机是演示前提

扬声器播放伴奏会重新进入麦克风，让能量检测误以为用户一直在唱。黑客松现场应：

- 主演示使用有线耳机或独立监听。
- `getUserMedia` 在耳机场景关闭 `echoCancellation`、`noiseSuppression` 和 `autoGainControl`，避免唱声被语音算法扭曲。
- 无耳机模式默认仅提供手动 `帮我接`，或开启回声消除并降低自动判断置信度。

## 9. 状态机与事件

推荐状态：

```text
idle -> calibrating -> ready -> count_in -> singing
singing -> rescue_armed -> rescuing -> singing
singing -> paused -> singing
singing -> completed -> recap
```

核心事件：

```ts
type SingEvent =
  | { type: 'SONG_STARTED'; at: number }
  | { type: 'SECTION_ENTERED'; section: string; at: number }
  | { type: 'USER_STARTED'; at: number }
  | { type: 'USER_STOPPED'; at: number; silenceMs: number }
  | { type: 'RESCUE_STARTED'; at: number; lineId: string; source: 'auto' | 'manual' }
  | { type: 'USER_RESUMED'; at: number }
  | { type: 'RESCUE_ENDED'; at: number; recovered: boolean }
  | { type: 'HIGHLIGHT_COMPLETED'; at: number; lineId: string }
  | { type: 'SONG_COMPLETED'; at: number }
```

每首歌设置互动预算：明显语音/欢呼最多 3 至 5 次，同类反馈至少间隔 8 秒。事件引擎先检查预算和冷却，再允许角色出现。

## 10. GitHub 开源技术选型

以下成熟度以 2026-06-18 的仓库状态与官方说明为依据；星标只用于观察社区采用度，不代表质量保证。

| 能力 | 项目 | 许可证 | 判断 | MVP 用法 |
| --- | --- | --- | --- | --- |
| 浏览器 VAD | [ricky0123/vad](https://github.com/ricky0123/vad) | MIT（发布前再次核对包内 LICENSE） | 约 2k stars，基于 Silero + ONNX Runtime Web，React/browser 接入直接 | 作为辅助置信度，不单独决定“是否在唱” |
| 实时音高 | [pitchy](https://github.com/ianprime0509/pitchy) | MIT（发布前再次核对包内 LICENSE） | 纯 JS，面向浏览器实时 tuner；社区体量小但 API 简洁 | 计算 pitch 与 clarity，参与演唱检测和轻量高光判断 |
| 音轨调度 | [Tone.js](https://github.com/Tonejs/Tone.js) | MIT | 约 14.6k stars，Web Audio 音乐调度成熟 | 可用于 transport/音轨，但核心双轨同步用原生 Web Audio 已足够 |
| 波形与选段 | [wavesurfer.js](https://github.com/katspaugh/wavesurfer.js) | BSD-3-Clause | 约 10.3k stars，适合波形、区域和重唱片段 UI | P1 唱后高光与片段重唱，不放进首日关键链路 |
| 状态机 | [XState](https://github.com/statelyai/xstate) | MIT | 约 29.7k stars，状态与事件模型成熟 | 流程复杂时采用；两天 MVP 也可先写 typed reducer |
| 离线伴奏分离 | [Demucs](https://github.com/facebookresearch/demucs) | MIT | 约 10.2k stars、效果成熟，但 Meta 原仓库已于 2025-01-01 归档 | 仅赛前离线制备伴奏；不要在浏览器或现场实时运行 |
| 音频转 MIDI | [Spotify Basic Pitch](https://github.com/spotify/basic-pitch) / [TS 版](https://github.com/spotify/basic-pitch-ts) | Apache-2.0 | Python 主仓约 5.2k stars，可输出 MIDI/pitch bends，单一乐器效果更好 | P1 离线提取参考旋律；固定 Demo 歌手工标注更稳 |
| 音乐特征 | [Essentia.js](https://github.com/mtg/essentia.js) | AGPL-3.0 | WebAssembly 音乐分析能力丰富，约 845 stars | 黑客松 MVP 避免引入；许可证和包体成本都不划算 |
| 歌声合成 | [OpenVPI DiffSinger](https://github.com/openvpi/DiffSinger) | Apache-2.0 | 约 3.1k stars，歌声质量与可控性强，但模型、字典、声库和推理链较重 | 只用于赛前生成授权 AI 声轨，不做现场实时推理 |

### 10.1 最终推荐依赖

P0 只增加：

```text
@ricky0123/vad-web   可选但推荐
pitchy               推荐
```

其余使用浏览器原生能力：

- `navigator.mediaDevices.getUserMedia`
- `AudioContext`
- `AudioBufferSourceNode`
- `GainNode`
- `AnalyserNode`
- `MediaRecorder`（只有要生成回忆音频时才启用）

不要为了“专业感”一次性接入 Tone.js、wavesurfer、XState、Essentia.js 和 Python 服务。依赖越少，现场音频问题越容易定位。

## 11. 哪些技术看似成熟但不适合现场

### 11.1 DiffSinger / SVC

成熟的是“准备好乐谱、歌词、模型后离线生成”，不是“听见用户停下后在几十毫秒内从任意歌词位置自然接唱”。实时接唱还涉及：

- 当前字词和音素位置。
- 用户速度漂移。
- 音高、发音、声线连续性。
- 推理与声码器延迟。
- 声库与声音权利。

因此它适合资产生产，不适合 MVP 控制回路。

### 11.2 Demucs / Spleeter

它们适合赛前把合法音源拆成伴奏和人声，不适合实时处理麦克风。且分离结果可能有人声残留，正式展示应人工检查并在 DAW 中修整。

### 11.3 自动歌曲结构分析

自动主歌/副歌/高音检测已有研究工具，但对两首 Demo 歌没有收益。手工时间轴只需一两个小时，却能直接消除最关键的不确定性。

## 12. 与现有代码的结合点

### 12.1 直接复用

- `src/lib/llm.ts`：继续使用 JSON LLM + null fallback。
- `server/local-proxy.mjs`：可新增声友局唱后反馈接口，不传原始音频，只传事件摘要。
- `src/lib/musicApi.ts`、QQ 音乐登录与歌单页：用于唱前选歌故事。
- `src/pages/SharePage.tsx`：改造成包厢回忆卡。
- Framer Motion 与现有全局视觉：用于角色状态、掌声和唱后转场。

### 12.2 新增模块建议

```text
src/features/sing-room/
  SingRoomPage.tsx
  RoomSetupPage.tsx
  RecapPage.tsx
  audioEngine.ts
  singingDetector.ts
  singRoomMachine.ts
  eventPolicy.ts
  recapAnalyzer.ts
  types.ts

src/data/sing-room/
  song-a.timeline.json
  song-b.timeline.json
```

`audioEngine.ts` 只负责声音与主时钟；`eventPolicy.ts` 只决定是否互动；React 组件不直接操作复杂音频节点。

## 13. 唱后反馈的可信实现

先由本地代码生成事实：

```json
{
  "participationRate": 0.84,
  "firstHalfParticipation": 0.71,
  "secondHalfParticipation": 0.93,
  "rescueCount": 1,
  "recoveredRescueCount": 1,
  "longestContinuousSingingSec": 18.4,
  "highlightLineId": "line-22"
}
```

再让 LLM 只做文案转换，并约束：

- 只能引用输入字段。
- 不写“音准完美”“气息专业”等未检测结论。
- 20 至 45 字。
- 一条高光、一条轻建议、一句角色留言。

LLM 失败时用模板：

```text
你在后半段参与得更完整，最长连续唱了 18 秒。阿和接唱 1 次后，你成功把主唱接了回来。
```

## 14. 两天实现顺序

### Day 1：先让接唱真的发生

1. 新增 `/sing-room` 路由和演唱页骨架。
2. 准备一首 60 至 90 秒对齐的伴奏/AI 声轨与时间轴。
3. 建立单一 `AudioContext`，验证双轨从 0 同步播放。
4. 实现 AI 声轨 Gain 淡入淡出和手动 `帮我接`。
5. 加麦克风校准、RMS 与 pitch clarity。
6. 完成自动救场、恢复退出和事件日志。

当晚验收：闭眼听也能感到停唱、接唱、交还主唱三个节点自然。

### Day 2：补全产品闭环

1. 加第二首歌和一个房间模式。
2. 加角色状态、歌词、掌声与互动预算。
3. 生成唱后事实、高光和 LLM/mock 留言。
4. 接回忆卡和“再唱一首”。
5. 接入本地歌单/QQ 音乐入口，但保证接口失败可降级。
6. 用比赛电脑、耳机和现场噪声做三轮完整彩排。

## 15. 验收指标

技术验收：

- 伴奏与 AI 声轨整段同步误差无可感知漂移。
- 在指定歌词段，连续停唱 1.6 秒后 300ms 内听到 AI 淡入。
- 用户恢复演唱后，AI 在 500ms 内开始退出且无硬切。
- 一首歌误触发救场不超过 1 次。
- 断网仍可完成唱前、唱中、唱后全链路。

产品验收：

- 观众在 30 秒内理解“AI 不是评分，而是接唱搭子”。
- 核心救场无需演示者解释也能被听见。
- 唱后反馈中的每个数字和结论都能追溯到事件日志。

## 16. 风险优先级

| 风险 | 影响 | 处理 |
| --- | --- | --- |
| 扬声器串音导致一直判定在唱 | 致命 | 耳机演示；3 秒校准；无耳机退回手动救场 |
| 双轨起点或长度不一致 | 致命 | 同源导出、同时启动、只调 Gain |
| 把换气误判为停唱 | 高 | 句尾保护窗、1.2/1.6 秒双阈值、4 秒冷却 |
| 浏览器自动播放/麦克风权限 | 高 | 用户点击“开始演唱”时同时创建 AudioContext 并请求权限 |
| LLM 网络失败 | 中 | 事实分析本地完成，文案模板兜底 |
| GitHub 模型安装耗时 | 中 | 现场不运行 Demucs、DiffSinger、Basic Pitch |
| 歌曲与声音版权 | 高 | 使用授权/自制短 Demo 资产，明确 AI 身份，不模仿明星 |

## 17. 三分钟 Demo 脚本

1. **20 秒**：从“我的歌单”进入热闹朋友局，小麦说明“没人打分，唱不上去阿和会接”。
2. **35 秒**：正常唱主歌，角色保持安静，证明它有分寸。
3. **25 秒**：在预设副歌停唱，AI 自动淡入接唱；演示者重新开口，AI 淡出。
4. **15 秒**：完成高光句，触发一次掌声。
5. **25 秒**：展示回忆卡：救场 1 次、成功接回 1 次、最长连续演唱片段。
6. **20 秒**：解释技术：本地感知 + 时间轴 + 实时事件决策，LLM 只负责表达。
7. **10 秒**：收尾金句。

> 别的 AI 告诉你唱得准不准；声友局在你不敢唱的时候，陪你把这首歌唱完。

## 18. 最终决策

这次黑客松最值得投入的不是“更强的生成模型”，而是把三个很小的音乐工程细节做真：

1. 所有音轨共享同一个音乐时钟。
2. 停唱判断尊重歌词结构与换气窗口。
3. AI 声轨加入和退出都发生在音乐边界上。

只要这三个细节听起来自然，产品的 AI 感、陪伴感和技术可信度就会同时成立。
