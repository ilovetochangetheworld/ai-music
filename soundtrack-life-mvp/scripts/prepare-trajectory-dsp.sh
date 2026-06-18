#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PYTHON="$ROOT/.audio-venv/bin/python"
SOURCE="$ROOT/music/周杰伦 - 轨迹.mp3"
WORK="$ROOT/audio-work/dsp"
PUBLIC="$ROOT/public/audio/trajectory"
CLIP_START="187.49"
CLIP_END="267.53"
CLIP_DURATION="80.04"

mkdir -p "$WORK" "$PUBLIC"
node "$ROOT/scripts/build-trajectory-timeline.mjs"

# Side information removes most centre vocals; a quiet low-passed copy restores bass weight.
ffmpeg -y -hide_banner -loglevel warning -i "$SOURCE" -filter_complex \
  "[0:a]asplit=2[wide][low];[wide]pan=stereo|c0=c0-c1|c1=c1-c0,volume=0.82[side];[low]lowpass=f=170,volume=0.48[bass];[side][bass]amix=inputs=2:normalize=0,alimiter=limit=0.93" \
  -c:a pcm_s16le "$WORK/accompaniment.wav"

# Mid information keeps the lead prominent enough for a short rescue overlay.
ffmpeg -y -hide_banner -loglevel warning -i "$SOURCE" \
  -af "pan=mono|c0=0.5*c0+0.5*c1,highpass=f=110,lowpass=f=9000,acompressor=threshold=-18dB:ratio=2.5:attack=12:release=180" \
  -c:a pcm_s16le "$WORK/rescue-lead.wav"

"$PYTHON" "$ROOT/scripts/generate-trajectory-harmony.py" \
  "$WORK/rescue-lead.wav" "$WORK/harmony.wav" --work-dir "$WORK/harmony-analysis"

ffmpeg -y -hide_banner -loglevel warning -i "$WORK/accompaniment.wav" \
  -af "atrim=start=$CLIP_START:end=$CLIP_END,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.08,afade=t=out:st=79.04:d=1,apad,atrim=0:$CLIP_DURATION" \
  -ar 44100 -c:a libmp3lame -b:a 128k "$PUBLIC/accompaniment.mp3"
ffmpeg -y -hide_banner -loglevel warning -i "$WORK/rescue-lead.wav" \
  -af "atrim=start=$CLIP_START:end=$CLIP_END,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.08,afade=t=out:st=79.04:d=1,apad,atrim=0:$CLIP_DURATION,volume=-5dB" \
  -ar 44100 -c:a libmp3lame -b:a 128k "$PUBLIC/rescue-lead.mp3"
ffmpeg -y -hide_banner -loglevel warning -i "$WORK/harmony.wav" \
  -af "atrim=start=$CLIP_START:end=$CLIP_END,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.08,afade=t=out:st=79.04:d=1,apad,atrim=0:$CLIP_DURATION,volume=-6dB" \
  -ar 44100 -c:a libmp3lame -b:a 128k "$PUBLIC/harmony.mp3"

echo "DSP fallback assets are ready in $PUBLIC"
