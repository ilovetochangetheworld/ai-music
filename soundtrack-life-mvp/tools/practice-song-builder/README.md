# Practice Song Builder（练习曲生成工具）

把「经过转换的曲库」做成 **AI 练歌房** 可直接加载的练习曲。这是**仓库内的单一源头**，
不依赖任何特定 IDE：CodeBuddy / Codex / 人工都直接运行这里的脚本。

> CodeBuddy 用户可通过 `practice-song-builder` 技能自动触发；该技能只是指向本目录的薄指针。
> Codex / 人工请直接按下文 SOP 运行，或用根 `package.json` 的 `npm run song:*` 脚本。

## 不变量（必须遵守，源自 AGENTS.md）

1. **不伪造音准**：`notes.json` 默认占位（`placeholder_requires_manual_review`）。自动生成的候选
   写入 `notes.candidate.json`（`reviewStatus=auto_generated_requires_review`），**人工校正**八度/时值后
   才写入 `notes.json` 并改为 `reviewed`。
   - ⚠️ 当前 `scoring.ts` 与 `scripts/validate-practice-catalog.mjs` 只看 `notes.length`、**未校验
     `reviewStatus`**。在补上门控前，绝不要把未校正音符写进 `notes.json`。
2. **版权**：`rights.status` 一律 `prototype`，保留来源说明；不得宣称商用授权。
3. **契约一致**：所有 JSON 必须匹配 `shared/contracts.ts` 与 `src/features/sing-room/types.ts`；
   改契约前先在 `docs/project/DECISIONS.md` 记录决策。
4. **运行时三轨必备**：accompaniment / rescue-lead / harmony 三条 mp3 缺一不可。
5. 不提交 demucs 缓存、`.venv`、原始整首歌；只提交裁剪后的练习片段与契约。

## 输入契约

每首歌一个 `song.json`（见 `song.example.json`）。必填：`id`、`title`、`artist`、
`lrc`（带时间戳歌词，源时间轴）、`segments`（源音频练习片段 `[{start,end}]`）。
常用可选项：`encoding`（轨迹这类 GB 系歌词用 `gb18030`）、`lyricFilter`（跳过词曲信息行）、
`minLineSec`、`sections`（输出时间轴）、`breathProtectionMs`、`mix`、`audio`。

音频来源（`audio` 三选一，对应不同「转换程度」）：

| 转换程度 | `audio` 配置 | 行为 |
|---|---|---|
| 仅完整混音 | `mix: 完整.mp3` | demucs 分轨 → 按 segments 裁剪拼接 |
| 已分轨 | `stems.vocals` + `stems.accompaniment` | 按 segments 裁剪拼接 |
| 已裁剪成品 | `stems.* + preclipped:true` | 仅增益/编码 |

> 路径相对 `song.json` 所在目录解析。`segments`/`harmony.regions` 用**源时间轴**，`sections` 用**输出时间轴**。

## SOP

从 `soundtrack-life-mvp/` 运行（脚本会自动识别仓库根）：

```bash
# 1) 生成契约（确定性，无音频依赖）。先 --dry-run 预览。
node tools/practice-song-builder/build-practice-song.mjs <song.json> [--dry-run]
npm run song:build -- <song.json>          # 等价封装

# 2) 生成三轨音频（需 ffmpeg；需分轨时需 .audio-venv + demucs）
PYTHON=.audio-venv/bin/python npm run song:audio -- <song.json>

# 3) 生成参考旋律候选（需 .audio-venv: torch/torchaudio，和声需 rubberband）
ffmpeg -y -i public/audio/<id>/rescue-lead.mp3 -c:a pcm_s16le /tmp/<id>-vocal.wav
.audio-venv/bin/python tools/practice-song-builder/generate-reference-notes.py \
  /tmp/<id>-vocal.wav public/audio/<id>/timeline.json public/catalog/<id>/notes.candidate.json
# → 人工校正后写入 public/catalog/<id>/notes.json，reviewStatus 改为 reviewed

# 4) 校验 + 构建
npm run catalog:validate && npm run typecheck && npm run build
```

多首歌对每个 `song.json` 重复 1–4。提交遵循仓库多智能体流程（分支/PR，勿直推 main）。

## 脚本

- `build-practice-song.mjs` — LRC + 段落 → timeline / manifest(运行时+catalog) / phrases / notes(占位) + 登记 index.json。纯 Node，可 `--dry-run`。
- `prepare-practice-audio.mjs` — 混音/分轨/已裁剪 → 三轨 mp3，按任意片段数构建 ffmpeg 滤镜图。
- `generate-reference-notes.py` — 人声 → 候选 `ReferenceNote[]`（待人工校正）。

## 已知局限

- 自动音符常见整体差八度、次谐波误判、过度切碎，**必须人工核对**。
- `bpm` 仅作展示，不参与评分。
# Note for current Torchaudio

If Demucs completes inference but fails while writing WAV files with `TorchCodec is required`, install the encoder into the audio environment:

```bash
uv pip install --python .audio-venv/bin/python torchcodec
```
