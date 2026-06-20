# APR-1003 — 《龙卷风》练歌资源包

## Source

- User-provided MP3 and GB18030 LRC.
- Prototype-only rights status; no commercial/public authorization is inferred.
- Source copies remain under ignored `music/` and are not part of the deployable package.

## Edit decision

The 250.94-second source was converted to an 80.76-second stage edit:

1. 107.26–147.73s: second pre-chorus and chorus.
2. 173.86–214.30s: final chorus and short falling refrain.
3. The long instrumental gap was removed with a 150ms crossfade.

The result reaches the first chorus at 12.67s and contains two chorus passes.

## Outputs

- `public/audio/tornado/accompaniment.mp3`
- `public/audio/tornado/rescue-lead.mp3`
- `public/audio/tornado/harmony.mp3`
- `public/audio/tornado/timeline.json`
- `public/catalog/tornado/manifest.json`
- `public/catalog/tornado/notes.json`
- `public/catalog/tornado/phrases.json`

All three audio tracks are exactly 80.76s. The LRC conversion produced 23 synchronized lyric events.

## Processing quality

The preferred Demucs model could not be downloaded because external execution quota was unavailable. The current assets use the documented local DSP fallback: stereo-side accompaniment reconstruction, center vocal extraction, and A-major diatonic harmony in chorus regions.

Measured levels:

- accompaniment: mean −17.0dB, peak −0.2dB
- rescue lead: mean −24.3dB, peak −7.3dB
- harmony: mean −30.4dB, peak −12.3dB

## Remaining review

- Listen on phone speaker and headphones around the 40.47s edit point.
- Replace DSP stems with Demucs stems when model execution is available.
- Extract and manually review reference notes before enabling pitch scores.
- Browser runtime loading could not be executed in this turn because the same external execution quota blocked starting the local preview server; catalog validation, typecheck, and production build passed.
