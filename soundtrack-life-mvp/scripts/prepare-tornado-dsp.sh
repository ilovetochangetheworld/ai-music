#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PYTHON="$ROOT/.audio-venv/bin/python"
SOURCE="$ROOT/music/周杰伦 - 龙卷风.mp3"
WORK="$ROOT/audio-work/tornado-dsp"
PUBLIC="$ROOT/public/audio/tornado"
CLIP_DURATION="80.76"

mkdir -p "$WORK" "$PUBLIC"
node "$ROOT/scripts/build-tornado-timeline.mjs"

ffmpeg -y -hide_banner -loglevel warning -i "$SOURCE" -filter_complex \
  "[0:a]asplit=2[wide][low];[wide]pan=stereo|c0=c0-c1|c1=c1-c0,volume=0.82[side];[low]lowpass=f=170,volume=0.48[bass];[side][bass]amix=inputs=2:normalize=0,alimiter=limit=0.93" \
  -c:a pcm_s16le "$WORK/accompaniment.wav"

ffmpeg -y -hide_banner -loglevel warning -i "$SOURCE" \
  -af "pan=mono|c0=0.5*c0+0.5*c1,highpass=f=110,lowpass=f=9000,acompressor=threshold=-18dB:ratio=2.5:attack=12:release=180" \
  -c:a pcm_s16le "$WORK/rescue-lead.wav"

"$PYTHON" "$ROOT/scripts/generate-trajectory-harmony.py" "$WORK/rescue-lead.wav" "$WORK/harmony.wav" \
  --work-dir "$WORK/harmony-analysis" --regions "119.93:147.73,173.86:200.65"

montage() {
  local input="$1"
  local output="$2"
  local volume="$3"
  ffmpeg -y -hide_banner -loglevel warning -i "$input" -filter_complex \
    "[0:a]atrim=start=107.26:end=147.73,asetpts=PTS-STARTPTS[a];[0:a]atrim=start=173.86:end=214.30,asetpts=PTS-STARTPTS[b];[a][b]acrossfade=d=0.15:c1=tri:c2=tri,afade=t=in:st=0:d=0.08,afade=t=out:st=79.76:d=1,volume=$volume,apad,atrim=0:$CLIP_DURATION[out]" \
    -map "[out]" -ar 44100 -c:a libmp3lame -b:a 128k "$output"
}

montage "$WORK/accompaniment.wav" "$PUBLIC/accompaniment.mp3" "1.0"
montage "$WORK/rescue-lead.wav" "$PUBLIC/rescue-lead.mp3" "0.56"
montage "$WORK/harmony.wav" "$PUBLIC/harmony.mp3" "0.50"

echo "Tornado DSP assets are ready in $PUBLIC"
