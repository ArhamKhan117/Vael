#!/usr/bin/env python3
"""Push the addresses in docs/ADDRESSES.md into the local .env files.

Nine contracts changed in one redeploy, across two apps and four files. Typing an address twice is
how apps/api/.env came to point at a superseded RewardVault for days, with the only
symptom a number that stayed at zero. This edits the value of a key that already exists and
touches nothing else: it never adds a key, never reorders a file, and never prints a value.

    python3 contracts/script/sync-env.py            # report what would change
    python3 contracts/script/sync-env.py --write    # change it
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ADDRESSES = ROOT / "docs" / "ADDRESSES.md"

# Address-book key -> the env key it fills in each file.
# IdentityRegistry is deliberately absent: the API reaches the registry through
# AgentRegistryAdapter and never addresses it directly.
API_KEYS = [
    "REPUTATION_REGISTRY_ADDRESS",
    "VALIDATION_REGISTRY_ADDRESS",
    "AGENT_REGISTRY_ADAPTER_ADDRESS",
    "VAEL_TOKEN_ADDRESS",
    "REWARD_VAULT_ADDRESS",
    "BADGE_NFT_ADDRESS",
    "QUEST_MANAGER_ADDRESS",
    "QUEST_ASC_ADDRESS",
    "NATIVE_PORTAL_ADDRESS",
    "CAMPAIGN_ESCROW_ADDRESS",
    "VAEL_HERO_ADDRESS",
    "RAID_BOSS_ADDRESS",
    "ARENA_ADDRESS",
    "LOOT_ADDRESS",
    "EQUIPMENT_ADDRESS",
    "MARKETPLACE_ADDRESS",
    "QUEST_PORTAL_ADDRESS",
    "PENGUINSWAP_ROUTER_ADDRESS",
    "PENGUINSWAP_WCTC_ADDRESS",
    "PENGUINSWAP_USD1_ADDRESS",
    "PENGUINSWAP_POOL_WCTC_USD1_500",
]

WEB_KEYS = [
    "VAEL_TOKEN_ADDRESS",
    "BADGE_NFT_ADDRESS",
    "QUEST_MANAGER_ADDRESS",
    "QUEST_ASC_ADDRESS",
    "NATIVE_PORTAL_ADDRESS",
    "CAMPAIGN_ESCROW_ADDRESS",
    "VAEL_HERO_ADDRESS",
    "RAID_BOSS_ADDRESS",
    "ARENA_ADDRESS",
    "LOOT_ADDRESS",
    "EQUIPMENT_ADDRESS",
    "MARKETPLACE_ADDRESS",
    "QUEST_PORTAL_ADDRESS",
    # PenguinSwap. Not ours, but the swap panel has to name the router it approves and the pool it
    # prices against, and a hardcoded address in a component is the thing this script exists to
    # stop happening.
    "PENGUINSWAP_ROUTER_ADDRESS",
    "PENGUINSWAP_WCTC_ADDRESS",
    "PENGUINSWAP_USD1_ADDRESS",
    "PENGUINSWAP_POOL_WCTC_USD1_500",
]

TARGETS = [
    (ROOT / "apps" / "api" / ".env", {key: key for key in API_KEYS}),
    (ROOT / "apps" / "web" / ".env.local", {key: f"NEXT_PUBLIC_{key}" for key in WEB_KEYS}),
]


def address_book() -> dict[str, str]:
    book: dict[str, str] = {}
    for line in ADDRESSES.read_text().splitlines():
        match = re.match(r"^([A-Z0-9_]+)=(0x[0-9a-fA-F]{40})$", line.strip())
        if match:
            book[match.group(1)] = match.group(2)
    return book


def main() -> int:
    write = "--write" in sys.argv
    book = address_book()
    if not book:
        print(f"no addresses found in {ADDRESSES}", file=sys.stderr)
        return 1

    changed = 0
    missing = 0
    for path, mapping in TARGETS:
        if not path.exists():
            print(f"{path.relative_to(ROOT)}: not present, skipped")
            continue
        text = path.read_text()
        for book_key, env_key in mapping.items():
            want = book.get(book_key)
            if not want:
                print(f"{path.relative_to(ROOT)}: {book_key} is not in the address book")
                missing += 1
                continue
            pattern = re.compile(rf"^{re.escape(env_key)}=(.*)$", re.MULTILINE)
            found = pattern.search(text)
            if not found:
                print(f"{path.relative_to(ROOT)}: {env_key} is not present, not adding it")
                missing += 1
                continue
            if found.group(1).strip().lower() == want.lower():
                continue
            # Only the key is named. The old value is a public address, but the rule here is that
            # this tool never prints anything out of an env file.
            print(f"{path.relative_to(ROOT)}: {env_key} updated")
            text = pattern.sub(f"{env_key}={want}", text, count=1)
            changed += 1
        if write:
            path.write_text(text)

    print(f"\n{changed} key(s) {'updated' if write else 'would change'}, {missing} not found")
    if not write and changed:
        print("re-run with --write to apply")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
