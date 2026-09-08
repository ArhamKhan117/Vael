#!/usr/bin/env python3
"""Promote a redeploy's addresses to the canonical keys in docs/ADDRESSES.md.

    python3 contracts/script/promote-addresses.py V10B_ VAEL_HERO_ADDRESS RAID_BOSS_ADDRESS ...
    python3 contracts/script/promote-addresses.py --write V10B_ VAEL_HERO_ADDRESS ...

The redeploy scripts record what they deployed under a prefixed key so the old address book stays
intact until somebody deliberately moves it. This is that deliberate move: for each key it copies
`<PREFIX><KEY>` over `<KEY>`, and records what `<KEY>` used to be as `<PREFIX>SUPERSEDED_<KEY>`, so
the history stays machine-readable rather than living only in prose.

It also appends the old address to the SUPERSEDED_QUEST_MANAGERS / _ARENAS / _RAID_BOSSES lists that
VerifyBaseline walks, because those are the checks that assert a superseded contract kept no
privilege, and a list that is not extended is a check that quietly stops covering the newest one.

Prints key names and addresses, which are public. Never touches an env file.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ADDRESSES = ROOT / "docs" / "ADDRESSES.md"

# Which canonical key feeds which list of superseded addresses.
REVOCATION_LISTS = {
    "QUEST_MANAGER_ADDRESS": "SUPERSEDED_QUEST_MANAGERS",
    "ARENA_ADDRESS": "SUPERSEDED_ARENAS",
    "RAID_BOSS_ADDRESS": "SUPERSEDED_RAID_BOSSES",
}


def main() -> int:
    args = [a for a in sys.argv[1:] if a != "--write"]
    write = "--write" in sys.argv
    if len(args) < 2:
        print(__doc__, file=sys.stderr)
        return 2
    prefix, keys = args[0], args[1:]

    text = ADDRESSES.read_text()
    book = dict(re.findall(r"^([A-Z0-9_]+)=(0x[0-9a-fA-F]{40})$", text, re.MULTILINE))

    superseded: list[tuple[str, str]] = []
    for key in keys:
        want = book.get(f"{prefix}{key}")
        if not want:
            print(f"{prefix}{key} is not in the address book", file=sys.stderr)
            return 1
        had = book.get(key)
        if had and had.lower() == want.lower():
            print(f"{key} already points at {want}")
            continue
        if had:
            superseded.append((key, had))
        print(f"{key}: {had or 'ABSENT'} -> {want}")
        pattern = re.compile(rf"^{re.escape(key)}=.*$", re.MULTILINE)
        text = pattern.sub(f"{key}={want}", text, count=1) if pattern.search(text) else (
            text.rstrip("\n") + f"\n{key}={want}\n"
        )

    for key, old in superseded:
        marker = f"{prefix}SUPERSEDED_{key}"
        if f"\n{marker}=" not in text:
            text = text.rstrip("\n") + f"\n{marker}={old}\n"

        list_key = REVOCATION_LISTS.get(key)
        if not list_key:
            continue
        pattern = re.compile(rf"^{list_key}=(.*)$", re.MULTILINE)
        found = pattern.search(text)
        if not found:
            text = text.rstrip("\n") + f"\n{list_key}={old}\n"
            continue
        current = [a for a in found.group(1).split(",") if a]
        if any(a.lower() == old.lower() for a in current):
            continue
        text = pattern.sub(f"{list_key}={','.join([*current, old])}", text, count=1)
        print(f"  and added it to {list_key}, which VerifyBaseline walks")

    if write:
        ADDRESSES.write_text(text)
        print(f"\n{len(superseded)} key(s) promoted and recorded")
    else:
        print(f"\n{len(superseded)} key(s) would change; re-run with --write")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
