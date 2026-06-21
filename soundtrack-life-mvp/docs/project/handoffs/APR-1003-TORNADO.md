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

The deployable assets now use the `htdemucs_ft` four-model ensemble for vocal/accompaniment separation. Chorus harmony is generated from the isolated vocal using an A-major diatonic pitch map. The local audio environment also requires `torchcodec` with current Torchaudio versions so Demucs can write its WAV stems.

Measured levels:

- accompaniment: mean −17.0dB, peak −1.1dB
- rescue lead: mean −22.4dB, peak −4.0dB
- harmony: mean −29.0dB, peak −11.1dB
- around the 40.47s montage point, accompaniment RMS changes by approximately 1.3dB; no digital clipping is present

## Remaining review

- Listen on phone speaker and headphones around the 40.47s edit point.
- Extract and manually review reference notes before enabling pitch scores.
- Complete browser runtime loading and microphone-denial checks after the final mobile listening pass.
