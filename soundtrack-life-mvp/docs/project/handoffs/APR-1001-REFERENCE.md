# APR-1001 — 参考旋律候选与审核门禁

## 当前产物

- `public/catalog/trajectory/notes.candidate.json`
- `public/catalog/tornado/notes.candidate.json`
- `tools/practice-song-builder/audit-reference-notes.mjs`

候选文件保持 `auto_generated_requires_review`；正式 `notes.json` 仍为占位状态。运行时现在只读取 `reviewStatus=reviewed` 的参考音符，防止自动候选误入音准评分。

## 自动审计结果

| 歌曲 | 候选音符 | MIDI 范围 | 高风险异常 | 低覆盖歌词行 | 可发布 |
| --- | ---: | --- | ---: | ---: | --- |
| 轨迹 | 100 | 37–57 | 24 | 4 | 否 |
| 龙卷风 | 119 | 37–64 | 46 | 5 | 否 |

高风险异常包括全局八度离群、同句局部大跳、歌词窗口越界和非法数据。自动审计只用于找问题，不能替代听辨。

## 下一步人工 SOP

1. 按歌词行循环播放 `rescue-lead.mp3`。
2. 删除气声、伴奏残留与错误低八度音符。
3. 校正起止时间、MIDI、长音标记和 `lineId`。
4. 运行 `npm run song:notes:audit -- <candidate> <timeline>`，清除高风险异常并检查低覆盖行。
5. 人工签字后复制为 `notes.json`，将 `reviewStatus` 改为 `reviewed`。
6. 用已知 ±50/±100 cents 合成样本验证评分方向，再启用音准总分。

在第 5 步完成之前，产品必须继续显示“参考旋律尚未完成人工校正”。
