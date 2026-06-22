# APR-1001 — 参考旋律候选与审核门禁

## 当前产物

- `public/catalog/trajectory/notes.candidate.json`
- `public/catalog/tornado/notes.candidate.json`
- `tools/practice-song-builder/audit-reference-notes.mjs`
- `#/lab/reference-review/trajectory` 与 `#/lab/reference-review/tornado` 逐句审核台
- `#/songs/manage` 歌曲管理入口，集中展示资源、参考旋律状态和审核操作

候选文件保持 `auto_generated_requires_review`；《轨迹》和《龙卷风》的正式 `notes.json` 已完成人工签字并标记为 `reviewed`。运行时只读取 `reviewStatus=reviewed` 的参考音符，防止自动候选误入音准评分。

## 自动审计结果

| 歌曲 | 候选音符 | MIDI 范围 | 高风险异常 | 低覆盖歌词行 | 可发布 |
| --- | ---: | --- | ---: | ---: | --- |
| 轨迹 | 100 | 已校正 | 0 | 0 | 是 |
| 龙卷风 | 119 | 已校正 | 0 | 0 | 是 |

高风险异常包括全局八度离群、同句局部大跳、歌词窗口越界和非法数据。自动审计只用于找问题，不能替代听辨。

审核台的“自动调整高风险”仅生成建议稿：逐句选择更平滑的等价八度，并将起止时间裁回已有歌词窗口。它不会新增或删除音符、不会填补低覆盖句，也不会代替人工勾选和签字。

## 下一步人工 SOP

1. 按歌词行循环播放 `rescue-lead.mp3`。
2. 删除气声、伴奏残留与错误低八度音符。
3. 校正起止时间、MIDI、长音标记和 `lineId`。
   审核台支持逐句播放、钢琴卷帘、±八度、精确时间/MIDI 编辑、删除与新增音符。
4. 运行 `npm run song:notes:audit -- <candidate> <timeline>`，清除高风险异常并检查低覆盖行。
5. 人工签字后复制为 `notes.json`，将 `reviewStatus` 改为 `reviewed`。
   审核台只有在高风险与缺失歌词行均为 0，并勾选逐句确认后，才开放正式 JSON 导出。
6. 用已知 ±50/±100 cents 合成样本验证评分方向，再启用音准总分。

新增歌曲在第 5 步完成之前，产品必须继续显示“参考旋律尚未完成人工校正”。
