#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PYTHON="$ROOT/.audio-venv/bin/python"
SOURCE="$ROOT/music/周杰伦 - 龙卷风.mp3"
WORK="$ROOT/audio-work/tornado"
PUBLIC="$ROOT/public/audio/tornado"
CLIP_DURATION="80.76"

mkdir -p "$WORK" "$PUBLIC"
node "$ROOT/scripts/build-tornado-timeline.mjs"

if [[ ! -x "$PYTHON" ]]; then
  echo "Missing .audio-venv." >&2
  exit 1
fi

"$PYTHON" -m demucs --two-stems vocals --float32 -n htdemucs_ft -o "$WORK/separated" "$SOURCE"

STEM_DIR="$WORK/separated/htdemucs_ft/周杰伦 - 龙卷风"
VOCAL="$STEM_DIR/vocals.wav"
ACCOMPANIMENT="$STEM_DIR/no_vocals.wav"
VOCAL_PCM="$WORK/vocals-pcm16.wav"
HARMONY="$WORK/harmony.wav"

ffmpeg -y -hide_banner -loglevel warning -i "$VOCAL" -c:a pcm_s16le "$VOCAL_PCM"
"$PYTHON" "$ROOT/scripts/generate-trajectory-harmony.py" "$VOCAL_PCM" "$HARMONY" \
  --work-dir "$WORK/harmony-analysis" --regions "119.93:147.73,173.86:200.65"

montage() {
  local input="$1"
  local output="$2"
  local volume="$3"
  ffmpeg -y -hide_banner -loglevel warning -i "$input" -filter_complex \
    "[0:a]atrim=start=107.26:end=147.73,asetpts=PTS-STARTPTS[a];[0:a]atrim=start=173.86:end=214.30,asetpts=PTS-STARTPTS[b];[a][b]acrossfade=d=0.15:c1=tri:c2=tri,afade=t=in:st=0:d=0.08,afade=t=out:st=79.76:d=1,volume=$volume,apad,atrim=0:$CLIP_DURATION[out]" \
    -map "[out]" -ar 44100 -c:a libmp3lame -b:a 128k "$output"
}

montage "$ACCOMPANIMENT" "$PUBLIC/accompaniment.mp3" "1.0"
montage "$VOCAL" "$PUBLIC/rescue-lead.mp3" "0.56"
montage "$HARMONY" "$PUBLIC/harmony.mp3" "0.50"

echo "Tornado assets are ready in $PUBLIC"
