# APR-1003 — 《龙卷风》练歌资源包

## 来源

- 用户提供的 MP3 和 GB18030 编码 LRC。
- 权利状态仅限原型，不推定拥有商业或公开发布授权。
- 源文件副本保留在已忽略的 `music/` 下，不属于可部署资源包。

## 剪辑决策

将 250.94 秒源文件转换为 80.76 秒舞台剪辑版：

1. 107.26–147.73 秒：第二段预副歌和副歌。
2. 173.86–214.30 秒：末段副歌和短收尾。
3. 删除过长间奏，并使用 150ms 交叉淡化连接。

成品在 12.67 秒进入首次副歌，共包含两遍副歌。

## 产物

- `public/audio/tornado/accompaniment.mp3`
- `public/audio/tornado/rescue-lead.mp3`
- `public/audio/tornado/harmony.mp3`
- `public/audio/tornado/timeline.json`
- `public/catalog/tornado/manifest.json`
- `public/catalog/tornado/notes.json`
- `public/catalog/tornado/phrases.json`

三条音轨时长均为 80.76 秒。LRC 转换得到 23 条同步歌词事件。

## 处理质量

可部署资源使用 `htdemucs_ft` 四模型集成完成人声/伴奏分离。副歌和声由独立人声按 A 大调自然音阶映射生成。当前 Torchaudio 版本下，本地音频环境还需要 `torchcodec`，Demucs 才能写入 WAV 分轨。

实测电平：

- accompaniment: mean −17.0dB, peak −1.1dB
- rescue lead: mean −22.4dB, peak −4.0dB
- harmony: mean −29.0dB, peak −11.1dB
- 40.47 秒拼接点附近伴奏 RMS 变化约 1.3dB，无数字削波

## 剩余检查

- 使用手机扬声器和耳机试听 40.47 秒剪辑点。
- 启用音高评分前提取并人工审核参考音符。
- 最终移动端试听后，完成浏览器运行时加载和麦克风拒绝恢复检查。
