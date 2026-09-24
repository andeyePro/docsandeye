#!/usr/bin/env python3
"""Turn a prepped shoot (.footage/<shoot>/ from prep-footage.sh) into sessions, a cut sheet and FCPXML.

Standard library only; runs on the Mac or in a container that can see the .footage folder.

    python3 tools/footage/assemble.py sync     .footage/<shoot>
    python3 tools/footage/assemble.py fcpxml   .footage/<shoot>   [--sections sections.json]
    python3 tools/footage/assemble.py cutsheet .footage/<shoot>   [--sections sections.json]

sync
    Finds, for every pair of files with speech, the time offset at which the same words were
    said (4-word phrases matched across whisper transcripts, voted to 0.1 s). Files linked by a
    confident offset form one session; files without audio (screen captures) and files that match
    nothing are placed by their recorded creation time when it falls inside a session, flagged
    `approximate`. Writes sessions.json and, per session, session-NN.txt: the transcript as
    timecoded sentences on the session clock, the input for deciding sections.

fcpxml
    Writes <shoot>.fcpxml (FCPXML 1.11, Final Cut Pro 11 or later): one multicam clip per
    session with an angle per camera, the files placed at their synced offsets, and a project per
    session whose timeline holds that multicam clip. With a sections file, each section becomes a
    chapter marker plus a keyword range (keep / cut / alternate take) and troubleshooting spans get
    to-do markers. Final Cut's own audio sync can refine any angle afterwards.

cutsheet
    Writes cut-sheet.md from sections.json: per contract section, the take to use, its session
    time range and source files, and every span marked cut, with the reason.

sections.json is authored (by a person or by Claude reading session-NN.txt):
    [{"session": 1, "start": 12.0, "end": 245.5, "section": "Electrolysis", "step": "step-05-...",
      "kind": "instruction" | "troubleshooting" | "other", "take": 2, "keep": true, "note": "..."}]
    Instead of "session", an entry may name a "file" (catalogue id) with start/end on that file's own
    clock; it is placed in that file's session. Prefer this: it survives a re-sync.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime
from fractions import Fraction
from pathlib import Path
from urllib.parse import quote
from xml.sax.saxutils import escape, quoteattr

NGRAM = 4
BIN_S = 0.1
MIN_VOTES = 6


# --- catalogue -------------------------------------------------------------------------------

def _tags(probe: dict) -> dict:
    tags = dict((probe.get("format") or {}).get("tags") or {})
    for s in probe.get("streams") or []:
        for k, v in (s.get("tags") or {}).items():
            tags.setdefault(k, v)
    return {k.lower(): v for k, v in tags.items()}


def _rate(text: str | None) -> Fraction | None:
    if not text or text in ("0/0", "0"):
        return None
    try:
        r = Fraction(text)
    except (ValueError, ZeroDivisionError):
        return None
    return r if r > 0 else None


def camera_of(path: str, tags: dict) -> str:
    model = tags.get("com.apple.quicktime.model") or tags.get("model")
    if model:
        return str(model)
    name = Path(path).name.lower()
    if "screen" in name or "bildschirm" in name:
        return "Screen capture"
    if tags.get("major_brand", "").strip().upper().startswith("XAVC") or re.match(r"c\d{4}", name):
        return "Sony"
    return Path(path).parent.name or "Camera"


def created_of(tags: dict) -> datetime | None:
    for key in ("com.apple.quicktime.creationdate", "creation_time"):
        v = tags.get(key)
        if not v:
            continue
        try:
            return datetime.fromisoformat(str(v).replace("Z", "+00:00"))
        except ValueError:
            continue
    return None


def load_catalogue(shoot: Path) -> list[dict]:
    files = []
    for entry in json.loads((shoot / "catalogue.json").read_text()):
        probe = entry.get("probe") or {}
        if not probe.get("streams"):
            print(f"unreadable (no probe data, fix permissions and re-run prep): {entry['path']}", file=sys.stderr)
            continue
        tags = _tags(probe)
        streams = probe.get("streams") or []
        video = next((s for s in streams if s.get("codec_type") == "video" and not (s.get("disposition") or {}).get("attached_pic")), None)
        audio = next((s for s in streams if s.get("codec_type") == "audio"), None)
        duration = float((probe.get("format") or {}).get("duration") or 0)
        files.append({
            "id": entry["id"],
            "path": entry["path"],
            "name": Path(entry["path"]).stem,
            "camera": camera_of(entry["path"], tags),
            "created": created_of(tags),
            "duration": duration,
            "width": int(video["width"]) if video else None,
            "height": int(video["height"]) if video else None,
            "fps": _rate(video.get("avg_frame_rate") or video.get("r_frame_rate")) if video else None,
            "audio_rate": int(audio.get("sample_rate") or 48000) if audio else None,
            "audio_channels": int(audio.get("channels") or 2) if audio else None,
            "words": load_words(shoot / "transcripts" / f"{entry['id']}.json"),
            # Has speech to sync by but no transcript yet: prep-footage.sh has not reached it.
            "pending": audio is not None and not (shoot / "transcripts" / f"{entry['id']}.json").exists(),
        })
    return files


def load_words(path: Path) -> list[tuple[float, str]]:
    if not path.exists():
        return []
    data = json.loads(path.read_text())
    words = []
    for seg in data.get("transcription") or []:
        text = re.sub(r"[^a-z0-9']+", " ", (seg.get("text") or "").lower()).strip()
        if not text:
            continue
        t = (seg.get("offsets") or {}).get("from", 0) / 1000.0
        for w in text.split():
            words.append((t, w))
    return words


# --- sync ------------------------------------------------------------------------------------

def pair_offset(a: list[tuple[float, str]], b: list[tuple[float, str]]) -> tuple[float, int] | None:
    """Offset d such that time_in_a = time_in_b + d, with its vote count; None when unconvincing."""
    index: dict[tuple[str, ...], list[float]] = defaultdict(list)
    for i in range(len(a) - NGRAM + 1):
        index[tuple(w for _, w in a[i:i + NGRAM])].append(a[i][0])
    votes: Counter[int] = Counter()
    for i in range(len(b) - NGRAM + 1):
        gram = tuple(w for _, w in b[i:i + NGRAM])
        hits = index.get(gram)
        if not hits or len(hits) > 3:  # common phrases vote for everything; skip them
            continue
        for ta in hits:
            votes[round((ta - b[i][0]) / BIN_S)] += 1
    if not votes:
        return None
    best, n = votes.most_common(1)[0]
    n += votes.get(best - 1, 0) + votes.get(best + 1, 0)
    if n < MIN_VOTES:
        return None
    # Weighted mean over the winning bin and its neighbours.
    num = sum(k * votes.get(k, 0) for k in (best - 1, best, best + 1))
    return (num / n) * BIN_S, n


def build_sessions(files: list[dict]) -> list[dict]:
    speech = [f for f in files if len(f["words"]) >= NGRAM]
    # Graph of confident offsets; place each connected component on one clock.
    edges: dict[str, list[tuple[str, float, int]]] = defaultdict(list)
    for i, fa in enumerate(speech):
        for fb in speech[i + 1:]:
            r = pair_offset(fa["words"], fb["words"])
            if r:
                d, n = r  # t_a = t_b + d  =>  start_b = start_a + d  (on a shared clock)
                edges[fa["id"]].append((fb["id"], d, n))
                edges[fb["id"]].append((fa["id"], -d, n))
    by_id = {f["id"]: f for f in files}
    placed: dict[str, float] = {}
    sessions = []
    # Seed each component from its longest file so the reference angle spans the session.
    for seed in sorted(speech, key=lambda f: -f["duration"]):
        if seed["id"] in placed:
            continue
        comp = {seed["id"]: 0.0}
        queue = [seed["id"]]
        while queue:
            cur = queue.pop()
            for other, d, _n in sorted(edges[cur], key=lambda e: -e[2]):
                if other not in comp:
                    comp[other] = comp[cur] + d
                    queue.append(other)
        placed.update(comp)
        lo = min(comp.values())
        members = [{"id": k, "start": round(v - lo, 3), "approximate": False} for k, v in comp.items()]
        sessions.append({"members": members})

    # Anything unplaced: by creation time against a placed member with a creation time.
    for f in files:
        if f["id"] in placed:
            continue
        home = None
        if f["created"]:
            for s in sessions:
                for m in s["members"]:
                    ref = by_id[m["id"]]
                    if m["approximate"] or not ref["created"]:
                        continue
                    t = m["start"] + (f["created"] - ref["created"]).total_seconds()
                    span = max(mm["start"] + by_id[mm["id"]]["duration"] for mm in s["members"])
                    if -60 <= t <= span + 60:
                        home = (s, t)
                        break
                if home:
                    break
        if home:
            home[0]["members"].append({"id": f["id"], "start": round(home[1], 3), "approximate": True})
        else:
            sessions.append({"members": [{"id": f["id"], "start": 0.0, "approximate": f["created"] is None}]})

    for s in sessions:
        lo = min(m["start"] for m in s["members"])
        for m in s["members"]:
            m["start"] = round(m["start"] - lo, 3)
        s["members"].sort(key=lambda m: (m["start"], m["id"]))
        s["duration"] = round(max(m["start"] + by_id[m["id"]]["duration"] for m in s["members"]), 3)
        firsts = [by_id[m["id"]]["created"] for m in s["members"] if by_id[m["id"]]["created"]]
        s["created"] = min(firsts).isoformat() if firsts else None
    sessions.sort(key=lambda s: (s["created"] or "", -s["duration"]))
    for i, s in enumerate(sessions, 1):
        s["number"] = i
    return sessions


def session_transcript(session: dict, by_id: dict) -> list[tuple[float, str]]:
    """Sentences on the session clock, taken from the member with the most words per stretch."""
    best = max((m for m in session["members"]), key=lambda m: len(by_id[m["id"]]["words"]), default=None)
    if not best or not by_id[best["id"]]["words"]:
        return []
    words = [(t + best["start"], w) for t, w in by_id[best["id"]]["words"]]
    # Fill spans the main member does not cover from the other members.
    covered_to = best["start"] + by_id[best["id"]]["duration"]
    for m in session["members"]:
        if m is best:
            continue
        for t, w in by_id[m["id"]]["words"]:
            tt = t + m["start"]
            if tt < best["start"] or tt > covered_to:
                words.append((tt, w))
    words.sort(key=lambda x: x[0])  # stable: words sharing a timestamp keep their spoken order
    lines, cur, t0, last = [], [], None, None
    for t, w in words:
        if cur and (t - last > 1.5 or len(cur) >= 30):
            lines.append((t0, " ".join(cur)))
            cur = []
        if not cur:
            t0 = t
        cur.append(w)
        last = t
    if cur:
        lines.append((t0, " ".join(cur)))
    return lines


def tc(seconds: float) -> str:
    s = int(seconds)
    return f"{s // 3600:d}:{s % 3600 // 60:02d}:{s % 60:02d}"


def cmd_sync(shoot: Path) -> None:
    files = load_catalogue(shoot)
    by_id = {f["id"]: f for f in files}
    pending = [f for f in files if f["pending"]]
    # Files still to be transcribed are left out rather than placed by guesswork; re-run sync
    # when prep-footage.sh has finished and they join their sessions.
    sessions = build_sessions([f for f in files if not f["pending"]])
    out = []
    for s in sessions:
        out.append({
            "number": s["number"], "created": s["created"], "duration": s["duration"],
            "members": [{**m, "camera": by_id[m["id"]]["camera"], "path": by_id[m["id"]]["path"],
                         "duration": by_id[m["id"]]["duration"], "words": len(by_id[m["id"]]["words"])}
                        for m in s["members"]],
        })
        lines = [f"# Session {s['number']:02d} — {tc(s['duration'])} long, started {s['created'] or 'unknown'}", ""]
        for m in s["members"]:
            f = by_id[m["id"]]
            flag = " (placed by clock, approximate)" if m["approximate"] else ""
            lines.append(f"# {m['id']} {f['camera']}: {Path(f['path']).name} at +{tc(m['start'])}{flag}")
        lines.append("")
        lines += [f"[{tc(t)}] {text}" for t, text in session_transcript(s, by_id)]
        (shoot / f"session-{s['number']:02d}.txt").write_text("\n".join(lines) + "\n")
    (shoot / "sessions.json").write_text(json.dumps(
        {"sessions": out, "pending": [{"id": f["id"], "path": f["path"], "camera": f["camera"]} for f in pending]}, indent=1))
    print(f"{len(files)} files, {len(sessions)} sessions, {len(pending)} not yet transcribed -> {shoot / 'sessions.json'}")
    for s in out:
        cams = ", ".join(sorted({m["camera"] for m in s["members"]}))
        print(f"  session {s['number']:02d}: {tc(s['duration'])}, {len(s['members'])} files ({cams})")


# --- FCPXML ----------------------------------------------------------------------------------

def _frame(fps: Fraction | None) -> Fraction:
    # Common camera rates to their exact FCP frame durations.
    if fps is None:
        return Fraction(1, 25)
    for exact in (Fraction(24000, 1001), Fraction(30000, 1001), Fraction(60000, 1001)):
        if abs(float(fps) - float(exact)) < 0.01:
            return 1 / exact
    return 1 / Fraction(round(float(fps)))


def _t(seconds: float, frame: Fraction) -> str:
    frames = round(Fraction(seconds) / frame)
    v = frames * frame
    return f"{v.numerator}/{v.denominator}s" if v.denominator != 1 else f"{v.numerator}s"


def _format_name(w: int | None, h: int | None, frame: Fraction) -> str:
    rate = 1 / frame
    rate_s = {Fraction(24000, 1001): "2398", Fraction(30000, 1001): "2997", Fraction(60000, 1001): "5994"}.get(rate, str(round(float(rate))))
    return f"FFVideoFormat{h or 1080}p{rate_s}" if (w, h) in ((1920, 1080), (3840, 2160)) and h else ""


def resolve_sections(sections: list[dict], sessions: list[dict]) -> list[dict]:
    """Convert entries authored on a file's clock (`file`, times relative to that file's start) to the
    session clock, filling in `session`; entries already on the session clock pass through."""
    where = {m["id"]: (s["number"], m["start"]) for s in sessions for m in s["members"]}
    out = []
    for sec in sections:
        if "file" in sec:
            if sec["file"] not in where:
                print(f"sections: file {sec['file']} is in no session; entry skipped", file=sys.stderr)
                continue
            number, start = where[sec["file"]]
            sec = {**sec, "session": number, "start": float(sec["start"]) + start, "end": float(sec["end"]) + start}
        out.append(sec)
    return out


def cmd_fcpxml(shoot: Path, sections: list[dict], only: int | None = None) -> None:
    """One `session-NN.fcpxml` per session (or just `only`), each importing as its own event, so an
    editor can start on session 1 while later sessions are still being prepped and copy grades
    between them inside one library."""
    files = {f["id"]: f for f in load_catalogue(shoot)}
    sessions = load_sessions(shoot)
    sections = resolve_sections(sections, sessions)
    for s in sessions:
        if only is None or s["number"] == only:
            write_session_fcpxml(shoot, s, files, sections)


def load_sessions(shoot: Path) -> list[dict]:
    data = json.loads((shoot / "sessions.json").read_text())
    return data["sessions"] if isinstance(data, dict) else data


def write_session_fcpxml(shoot: Path, s: dict, files: dict, sections: list[dict]) -> None:
    res, formats, body = [], {}, []
    rid = 0

    def next_id() -> str:
        nonlocal rid
        rid += 1
        return f"r{rid}"

    def fmt_for(f: dict) -> str:
        key = (f["width"], f["height"], _frame(f["fps"]))
        if key not in formats:
            fid = next_id()
            w, h, frame = key
            name = _format_name(w, h, frame)
            attrs = f' name="{name}"' if name else ""
            res.append(f'<format id="{fid}"{attrs} frameDuration="{_t(float(frame), frame)}" width="{w or 1920}" height="{h or 1080}"/>')
            formats[key] = fid
        return formats[key]

    asset_ids = {}
    for fid in [m["id"] for m in s["members"]]:
        f = files[fid]
        aid = next_id()
        asset_ids[fid] = aid
        frame = _frame(f["fps"])
        has_video = f["width"] is not None
        fmt = f' format="{fmt_for(f)}"' if has_video else ""
        audio = (f' hasAudio="1" audioSources="1" audioChannels="{f["audio_channels"]}" audioRate="{f["audio_rate"]}"'
                 if f["audio_rate"] else "")
        src = "file://" + quote(f["path"])
        res.append(
            f'<asset id="{aid}" name={quoteattr(f["name"])} start="0s" duration="{_t(f["duration"], frame)}"'
            f' hasVideo="{1 if has_video else 0}"{fmt}{audio}>'
            f'<media-rep kind="original-media" src={quoteattr(src)}/></asset>')

    by_session = defaultdict(list)
    for sec in sections:
        by_session[int(sec["session"])].append(sec)

    if True:
        members = [m for m in s["members"] if files[m["id"]]["width"] is not None]
        if not members:
            return
        ref = files[members[0]["id"]]
        frame = _frame(ref["fps"])
        mfmt = fmt_for(ref)
        mid = next_id()
        angles = defaultdict(list)
        for m in members:
            angles[files[m["id"]]["camera"]].append(m)
        angle_xml = []
        # Angle 1 (the one the timeline shows and plays) is the camera with the most footage in the session.
        ranked = sorted(angles.items(), key=lambda kv: (-sum(files[m["id"]]["duration"] for m in kv[1]), kv[0]))
        for n, (camera, ms) in enumerate(ranked, 1):
            spine, cursor = [], 0.0
            for m in sorted(ms, key=lambda m: m["start"]):
                f = files[m["id"]]
                start = max(m["start"], cursor)
                if start > cursor:
                    spine.append(f'<gap name="Gap" offset="{_t(cursor, frame)}" start="3600s" duration="{_t(start - cursor, frame)}"/>')
                trim = start - m["start"]  # overlap with the previous clip on this angle: trim the head
                dur = f["duration"] - trim
                if dur <= 0:
                    continue
                spine.append(
                    f'<asset-clip ref="{asset_ids[m["id"]]}" name={quoteattr(f["name"])} offset="{_t(start, frame)}"'
                    f' start="{_t(trim, frame)}" duration="{_t(dur, frame)}"/>')
                cursor = start + dur
            angle_xml.append(f'<mc-angle name={quoteattr(camera)} angleID="angle-{n}">{"".join(spine)}</mc-angle>')
        name = f"Session {s['number']:02d}"
        res.append(f'<media id="{mid}" name="{name} multicam"><multicam format="{mfmt}" tcStart="0s" tcFormat="NDF">'
                   f'{"".join(angle_xml)}</multicam></media>')

        marks = []
        for sec in sorted(by_session.get(s["number"], []), key=lambda x: x["start"]):
            st, en = float(sec["start"]), float(sec["end"])
            label = sec.get("section") or sec.get("step") or "Section"
            take = ", take " + str(sec["take"]) if sec.get("take") else ""
            if sec.get("kind") == "troubleshooting":
                marks.append(f'<marker start="{_t(st, frame)}" duration="{_t(float(frame), frame)}"'
                             f' value={quoteattr(f"CUT: troubleshooting — {label}" + (" (" + sec["note"] + ")" if sec.get("note") else ""))} completed="0"/>')
                kw = "cut, troubleshooting"
            elif sec.get("keep"):
                marks.append(f'<chapter-marker start="{_t(st, frame)}" duration="{_t(float(frame), frame)}"'
                             f' value={quoteattr(f"{label}{take}")} posterOffset="0s"/>')
                kw = "keep, " + label
            else:
                marks.append(f'<marker start="{_t(st, frame)}" duration="{_t(float(frame), frame)}"'
                             f' value={quoteattr(f"ALT: {label}{take}" + (" (" + sec["note"] + ")" if sec.get("note") else ""))}/>')
                kw = "alternate take, " + label
            marks.append(f'<keyword start="{_t(st, frame)}" duration="{_t(max(en - st, float(frame)), frame)}" value={quoteattr(kw)}/>')
        # FCP wants markers and keywords in time order inside the clip.
        marks.sort(key=lambda x: Fraction(re.search(r'start="([^"]+)s"', x).group(1)))
        body.append(
            f'<project name={quoteattr(name)}><sequence format="{mfmt}" duration="{_t(s["duration"], frame)}" tcStart="0s"'
            f' tcFormat="NDF" audioLayout="stereo" audioRate="48k"><spine>'
            f'<mc-clip ref="{mid}" name={quoteattr(name)} offset="0s" start="0s" duration="{_t(s["duration"], frame)}">'
            f'<mc-source angleID="angle-1" srcEnable="all"/>{"".join(marks)}</mc-clip></spine></sequence></project>')

    event = f"{shoot.name} session {s['number']:02d}"
    xml = ('<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE fcpxml>\n<fcpxml version="1.11">\n<resources>\n'
           + "\n".join(res) + "\n</resources>\n<library>\n<event name=" + quoteattr(event) + ">\n"
           + "\n".join(body) + "\n</event>\n</library>\n</fcpxml>\n")
    out = shoot / f"session-{s['number']:02d}.fcpxml"
    out.write_text(xml)
    print(f"wrote {out}")


def cmd_cutsheet(shoot: Path, sections: list[dict]) -> None:
    sessions = {s["number"]: s for s in load_sessions(shoot)}
    sections = resolve_sections(sections, list(sessions.values()))
    lines = [f"# Cut sheet — {shoot.name}", "",
             "Times are on each session's multicam clock (the timeline of that session's project in the FCPXML).", ""]
    order = []
    for sec in sections:
        key = sec.get("section") or sec.get("step") or "Other"
        if key not in order:
            order.append(key)
    for key in order:
        group = [x for x in sections if (x.get("section") or x.get("step") or "Other") == key]
        lines.append(f"## {key}")
        lines.append("")
        for x in sorted(group, key=lambda x: (x["session"], x["start"])):
            verdict = "KEEP" if x.get("keep") else ("CUT" if x.get("kind") == "troubleshooting" else "alternate")
            take = f", take {x['take']}" if x.get("take") else ""
            cams = ", ".join(sorted({m["camera"] for m in sessions[int(x["session"])]["members"]
                                     if m["start"] <= float(x["end"]) and m["start"] + m["duration"] >= float(x["start"])}))
            lines.append(f"- **{verdict}** session {int(x['session']):02d} {tc(float(x['start']))}–{tc(float(x['end']))}{take}"
                         f" ({x.get('kind', 'instruction')}; cameras: {cams or 'none'})" + (f" — {x['note']}" if x.get("note") else ""))
        lines.append("")
    (shoot / "cut-sheet.md").write_text("\n".join(lines))
    print(f"wrote {shoot / 'cut-sheet.md'}")


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("command", choices=["sync", "fcpxml", "cutsheet"])
    ap.add_argument("shoot", type=Path)
    ap.add_argument("--sections", type=Path)
    ap.add_argument("--session", type=int, help="fcpxml: write only this session's file")
    a = ap.parse_args(argv)
    if not (a.shoot / "catalogue.json").exists():
        print(f"{a.shoot}: no catalogue.json (run prep-footage.sh first)", file=sys.stderr)
        return 66
    sections = []
    if a.command != "sync":
        path = a.sections or a.shoot / "sections.json"
        if path.exists():
            sections = json.loads(path.read_text())
        elif a.command == "cutsheet":
            print(f"{path}: not found", file=sys.stderr)
            return 66
    {"sync": lambda: cmd_sync(a.shoot), "fcpxml": lambda: cmd_fcpxml(a.shoot, sections, a.session),
     "cutsheet": lambda: cmd_cutsheet(a.shoot, sections)}[a.command]()
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
