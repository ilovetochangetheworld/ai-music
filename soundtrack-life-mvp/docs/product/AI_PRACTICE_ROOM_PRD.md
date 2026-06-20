# AI 练歌房 PRD

## Positioning

**AI 练歌房——听你唱，也陪你唱得更好。**

The product is a mobile-first, companion-led intelligent singing practice room. 小麦 is the only companion. Professional analysis is the capability; companionship is the delivery style.

## Core journey

```text
select prepared song -> choose free/focus practice -> calibrate -> sing
-> companion recap -> evidence clips -> five-dimension report
-> retry / next recommendation -> local growth history
```

## V1 behavior

- Every visible song is a complete practice package, not a generic playback item.
- Free mode never interrupts a phrase. Focus mode may show one silent hint after a line ends.
- The first lyric remains visible under a transparent countdown.
- The post-song first screen leads with one factual summary and a highlight, not a score wall.
- Detailed report covers pitch, rhythm, breath-control proxy, expression dynamics, and consistency.
- Overall score appears only in the detailed report and represents this session, not ability.
- Original recordings remain available for playback and deletion. Tuning is an explicit A/B experiment and never replaces the original.

## Out of scope

- QQ Music login, playlist import, broad music playback, rankings, voice cloning, arbitrary-song instant analysis, and spoken real-time correction.
- Legacy soundtrack and audio-coach experiences remain under `/lab` and are not primary navigation.

## V1 success criteria

- Mobile journey completes on three validated song packages.
- Pitch/rhythm scoring is reference-backed and insufficient data suppresses false scores.
- Report evidence opens the matching recording segment.
- Public web remains usable when analysis or LLM service is unavailable through factual local fallback.
- Growth history can be deleted and is local-only in V1.
