# Footage prep for shoot-first guides

For a shoot recorded on several cameras at once (a main camera, phones, screen captures) with no
slate or timecode sync, these two scripts get the footage to the point where an editor only makes
the creative choices: which angle, which audio, where to crop in.

## 1. Prep (on the Mac that can see the footage)

Open Terminal in this repository's folder (in Finder: right-click the folder, then New Terminal at
Folder), type the line below followed by a space, drag the footage folder onto the Terminal window,
and press Return:

    caffeinate -i bash tools/footage/prep-footage.sh

`caffeinate -i` keeps the Mac awake until it finishes. The script installs ffmpeg and whisper.cpp with
Homebrew if they are missing, downloads the whisper model once (about 1.6 GB), then for every video
and audio file writes a catalogue entry, a 16 kHz audio copy and a word-level transcript to
`.footage/<folder name>/` in this repository (gitignored). The footage itself is only read. Re-running
skips finished files, so it can be stopped and restarted. `WHISPER_MODEL=base.en` in front of the
command trades transcript quality for speed, and `FOOTAGE_OUT` set to a folder inside the Mac's Shared user folder writes the
output there instead, where an editor logged in as another user can open it. On a standard
(non-admin) account an admin runs `brew install ffmpeg whisper-cpp` once first.

## 2. Sessions, sections and the edit (anywhere Python 3.9+ runs)

    python3 tools/footage/assemble.py sync .footage/SHOOT

matches the same spoken phrases across cameras to line every file up on one clock per session, and
writes `sessions.json` plus `session-NN.txt`, each session's transcript as timecoded lines. Files with
no audio (screen captures) are placed by their recorded creation time and flagged approximate.

From those transcripts, someone (a person or Claude) writes `sections.json`: which span is which guide
section, which spans were troubleshooting rather than instruction, and which take to keep when a step
was filmed more than once (by default the last). Then:

    python3 tools/footage/assemble.py fcpxml .footage/SHOOT
    python3 tools/footage/assemble.py cutsheet .footage/SHOOT

`SHOOT.fcpxml` imports into Final Cut Pro 11 or later (File > Import > XML): one multicam clip per
session with an angle per camera, and one project per session whose timeline carries a chapter marker
at each kept section, a to-do marker at each troubleshooting span, and keyword ranges (keep, cut,
alternate take) you can filter in the browser. The angle with the most footage plays by default;
switch angles, audio and crops in the angle viewer as usual. If an angle is a few frames out, select
the multicam clip and use Final Cut's own audio sync on that angle. `cut-sheet.md` is the same
decisions as a list.

If Final Cut does not open the file, the fallback is its own sync: select one session's clips in the
browser, choose File > New Multicam Clip, tick Use audio for synchronization, and use `cut-sheet.md`
for the section times.
