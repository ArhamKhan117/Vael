#!/usr/bin/env python3
"""Refuse to let a superseded contract address be quoted as current.

    python3 scripts/check-stale-addresses.py

Every redeploy leaves a trail of addresses in prose, and prose does not fail a test. The README
once went on naming a superseded Arena through three redeploys, which is exactly the kind of thing
nobody notices until a reader pastes it into an explorer and finds a dead contract.

One file is deliberately exempt, because rewriting it would make it lie: docs/ADDRESSES.md, whose
history section exists to name superseded contracts. So is anything under docs/evidence/, which
records what the chain and the app showed at one moment.
"""
import re, subprocess
from pathlib import Path

book = Path("docs/ADDRESSES.md").read_text()
keys = dict(re.findall(r"^([A-Z0-9_]+)=(0x[0-9a-fA-F]{40})$", book, re.MULTILINE))

current = {v.lower() for k, v in keys.items()
           if not re.match(r"^(V\d|W3B|P10|SUPERSEDED|.*_V\d+_ADDRESS$)", k) and k.endswith(("_ADDRESS", "_500", "_3000", "USD1", "WCTC"))}
superseded = set()
for k, v in keys.items():
    if re.match(r"^(SUPERSEDED_|P10_SUPERSEDED_|V10C_SUPERSEDED_|.*_V\d+_ADDRESS$)", k):
        superseded.add(v.lower())
for k, v in keys.items():
    if re.match(r"^(V8_|V9_|V10_|V10B_)", k) and k.endswith("_ADDRESS"):
        superseded.add(v.lower())
for line in re.findall(r"^SUPERSEDED_[A-Z_]+=(.+)$", book, re.MULTILINE):
    for a in line.split(","):
        if a.strip():
            superseded.add(a.strip().lower())

# Anything still live is not stale, whatever list it also appears on.
superseded -= current
print(f"{len(current)} current, {len(superseded)} superseded addresses known\n")

files = subprocess.run(["git", "ls-files", "README.md", "docs", "apps", "contracts", "scripts", "tools"],
                       capture_output=True, text=True).stdout.split()
SKIP_DOC = {"docs/ADDRESSES.md"}
bad = []
for f in files:
    if f in SKIP_DOC or f.startswith("docs/evidence/") or f.endswith((".png", ".jpg", ".ogg", ".lock")):
        continue
    try:
        text = Path(f).read_text()
    except Exception:
        continue
    for addr in superseded:
        for m in re.finditer(re.escape(addr), text, re.IGNORECASE):
            line = text[:m.start()].count("\n") + 1
            bad.append((f, line, addr))
if bad:
    for f, line, addr in bad:
        print(f"  STALE {f}:{line}  {addr}")
    raise SystemExit(1)
print("  no superseded address is quoted as current anywhere")
