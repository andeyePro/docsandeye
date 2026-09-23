#!/usr/bin/env bash
# prep-footage.sh — catalogue and transcribe a shoot's raw footage on a Mac, unattended.
#
#   bash tools/footage/prep-footage.sh FOOTAGE_FOLDER [SHOOT_NAME]
#
# Reads every video and audio file under FOOTAGE_FOLDER (never modifies them) and writes, under
# .footage/SHOOT_NAME/ in this checkout (gitignored):
#   catalogue.json         one entry per file: path, duration, creation time, camera, streams (ffprobe)
#   audio/<n>.wav          16 kHz mono audio, the input to whisper
#   transcripts/<n>.json   word-level whisper.cpp transcript
#   log.txt                what ran, and anything that failed
#
# The shoot-first steps that follow (sync by transcript, sections, cut sheet, FCPXML) run from
# those files with tools/footage/assemble.py, which needs only Python 3.
#
# Needs Homebrew. Installs ffmpeg and whisper-cpp if missing and downloads the whisper model
# (about 1.6 GB, once, to ~/.cache/whisper). Safe to re-run: finished files are skipped.
# Model override: WHISPER_MODEL=base.en bash tools/footage/prep-footage.sh ...

set -euo pipefail

if [ $# -lt 1 ] || [ ! -d "$1" ]; then
  echo "usage: bash tools/footage/prep-footage.sh FOOTAGE_FOLDER [SHOOT_NAME]" >&2
  exit 64
fi

FOOTAGE="$(cd "$1" && pwd)"
SHOOT="${2:-$(basename "$FOOTAGE" | tr -c 'A-Za-z0-9._-\n' '-')}"
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="$(cd "$HERE/../.." && pwd)/.footage/$SHOOT"
MODEL_NAME="${WHISPER_MODEL:-large-v3-turbo}"
MODEL="$HOME/.cache/whisper/ggml-$MODEL_NAME.bin"

mkdir -p "$OUT/audio" "$OUT/transcripts" "$OUT/probe"
LOG="$OUT/log.txt"
log() { printf '%s %s\n' "$(date '+%H:%M:%S')" "$*" | tee -a "$LOG"; }

log "footage: $FOOTAGE"
log "output:  $OUT"

# --- tools -----------------------------------------------------------------------------------
if ! command -v brew >/dev/null 2>&1; then
  for b in /opt/homebrew/bin/brew /usr/local/bin/brew; do
    [ -x "$b" ] && eval "$("$b" shellenv)" && break
  done
fi
command -v brew >/dev/null 2>&1 || { log "Homebrew not found: install it from https://brew.sh then re-run"; exit 69; }
command -v ffmpeg >/dev/null 2>&1 || { log "installing ffmpeg"; brew install ffmpeg; }
command -v whisper-cli >/dev/null 2>&1 || { log "installing whisper-cpp"; brew install whisper-cpp; }

if [ ! -s "$MODEL" ]; then
  log "downloading whisper model $MODEL_NAME"
  mkdir -p "$(dirname "$MODEL")"
  curl -L --fail --progress-bar -o "$MODEL.part" \
    "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-$MODEL_NAME.bin"
  mv "$MODEL.part" "$MODEL"
fi

# --- catalogue -------------------------------------------------------------------------------
# One ffprobe JSON per file; names are a stable index so re-runs line up.
LIST="$OUT/files.txt"
find "$FOOTAGE" -type f \( -iname '*.mp4' -o -iname '*.mov' -o -iname '*.m4v' -o -iname '*.mts' \
  -o -iname '*.mxf' -o -iname '*.wav' -o -iname '*.m4a' -o -iname '*.mp3' \) \
  ! -name '._*' | LC_ALL=C sort > "$LIST"
COUNT="$(wc -l < "$LIST" | tr -d ' ')"
log "$COUNT media files"

n=0
while IFS= read -r f; do
  n=$((n + 1))
  id="$(printf '%03d' "$n")"
  [ -s "$OUT/probe/$id.json" ] || ffprobe -v error -print_format json -show_format -show_streams "$f" > "$OUT/probe/$id.json" || log "ffprobe failed: $f"
done < "$LIST"

# catalogue.json: [{id, path, probe}] assembled with the macOS system python (no packages).
python3 - "$LIST" "$OUT" <<'PY'
import json, sys, pathlib
lst, out = sys.argv[1], pathlib.Path(sys.argv[2])
entries = []
for i, line in enumerate(pathlib.Path(lst).read_text().splitlines(), 1):
    pid = f"{i:03d}"
    p = out / "probe" / f"{pid}.json"
    probe = json.loads(p.read_text()) if p.exists() and p.stat().st_size else None
    entries.append({"id": pid, "path": line, "probe": probe})
(out / "catalogue.json").write_text(json.dumps(entries, indent=1))
PY
log "catalogue.json written"

# --- audio + transcripts ---------------------------------------------------------------------
n=0
while IFS= read -r f; do
  n=$((n + 1))
  id="$(printf '%03d' "$n")"
  if ! grep -q '"codec_type": "audio"' "$OUT/probe/$id.json" 2>/dev/null; then
    log "$id no audio (screen capture?): $(basename "$f")"
    continue
  fi
  if [ ! -s "$OUT/audio/$id.wav" ]; then
    ffmpeg -nostdin -v error -y -i "$f" -map 0:a:0 -ac 1 -ar 16000 -c:a pcm_s16le "$OUT/audio/$id.wav" \
      || { log "$id audio extract failed: $f"; continue; }
  fi
  if [ ! -s "$OUT/transcripts/$id.json" ]; then
    log "$id transcribing $(basename "$f")"
    # -ml 1 -sow: one segment per word, so assemble.py gets word timings for sync and sections.
    whisper-cli -m "$MODEL" -l en -ml 1 -sow -oj -of "$OUT/transcripts/$id" -f "$OUT/audio/$id.wav" >> "$LOG" 2>&1 \
      || log "$id whisper failed"
  fi
done < "$LIST"

log "done. Tell Claude: footage prepped in .footage/$SHOOT"
