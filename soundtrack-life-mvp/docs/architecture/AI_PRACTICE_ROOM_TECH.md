# AI 练歌房 technical architecture

## Runtime

The React/Vite web app runs on GitHub Pages. Web Audio provides a single music clock, microphone telemetry, recording, and companion state. The public Node BFF accepts consented session uploads and proxies an internal FastAPI CPU analyzer. Local GPU tuning is experimental and disabled in production.

## Data flow

```text
validated song package
  -> browser playback + 80 ms telemetry + MediaRecorder
  -> POST session (recording + telemetry + manifest version)
  -> Python analysis (alignment + deterministic metrics + evidence)
  -> Node report response + optional grounded LLM wording
  -> recap/report UI + IndexedDB growth snapshot
```

## Scoring

- Pitch 30%: octave-tolerant cents error, accurate-frame coverage, sustained-note drift.
- Rhythm 25%: phrase onset/end and voiced-window timing against lyrics/beats.
- Breath 15%: phrase completion, unexpected gaps, sustained-note duration/decay; always labeled as a signal-based proxy.
- Expression 15%: section-level dynamic contrast and phrase energy; omit assertions at low confidence.
- Consistency 15%: variance across similar sections and first/second half.

Coverage below 20%, poor calibration, or low pitch confidence produces `insufficient_data`. LLM output never changes numeric facts.

## Services

- Node BFF: CORS, 25 MB multipart limit, opaque IDs, rate limits, TTL cleanup, optional LLM wording.
- Python analyzer: schema validation, ffmpeg decode, deterministic scoring, evidence and highlight selection.
- Local tuning spike: 8–12 second enhancement, correction limited to ±100 cents, A/B artifact and processing log. Production flag defaults off.

## Storage and privacy

Anonymous server sessions expire in 24 hours. V1 long-term history uses IndexedDB and stores report summaries, not raw recordings. Upload requires an explicit UI consent action.

## Deployment

Pages hosts the web build. `lulu.yixin.info` hosts Node BFF and an internal loopback FastAPI service under systemd. The GPU spike is local-only until the documented quality gate passes.
