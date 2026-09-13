#!/usr/bin/env python3
"""Promote a redeploy's addresses to the canonical keys in docs/ADDRESSES.md.

    python3 contracts/script/promote-addresses.py V10B_ VAEL_HERO_ADDRESS RAID_BOSS_ADDRESS ...
    python3 contracts/script/promote-addresses.py --write V10B_ VAEL_HERO_ADDRESS ...

The redeploy scripts record what they deployed under a prefixed key so the old address book stays
intact until somebody deliberately moves it. This is that deliberate move: for each key it copies
`<PREFIX><KEY>` over `<KEY>`, and records what `<KEY>` used to be as `<PREFIX>SUPERSEDED_<KEY>`, so
the history stays machine-readable rather than living only in prose.

It also rewrites the row in the "Current deployment" table, because that table is what a human
reads and the key block is what a machine reads, and the two disagreeing is worse than either being
wrong alone. One arena promotion moved only the key block, and the table went on naming
a superseded Arena while the chain, the env files and Loot.arena all named the new one. The script
now refuses to finish if any promoted address is missing from the table.

It appends the old address to the SUPERSEDED_QUEST_MANAGERS / _ARENAS / _RAID_BOSSES lists that
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
    "CAMPAIGN_ESCROW_ADDRESS": "SUPERSEDED_CAMPAIGN_ESCROWS",
}

# The name each key goes by in the "Current deployment" table.
TABLE_NAMES = {
    "VAEL_TOKEN_ADDRESS": "VaelToken",
    "REWARD_VAULT_ADDRESS": "RewardVault",
    "CAMPAIGN_ESCROW_ADDRESS": "CampaignEscrow",
    "BADGE_NFT_ADDRESS": "BadgeNFT",
    "VAEL_HERO_ADDRESS": "VaelHero",
    "QUEST_MANAGER_ADDRESS": "QuestManager",
    "QUEST_ASC_ADDRESS": "QuestASC",
    "NATIVE_PORTAL_ADDRESS": "NativePortal",
    "CAMPAIGN_PAYOUT_HOOK_ADDRESS": "CampaignPayoutHook",
    "RAID_BOSS_ADDRESS": "RaidBoss",
    "ARENA_ADDRESS": "Arena",
    "LOOT_ADDRESS": "Loot",
    "EQUIPMENT_ADDRESS": "Equipment",
    "MARKETPLACE_ADDRESS": "Marketplace",
}

BLOCKSCOUT = "https://creditcoin-testnet.blockscout.com"
TABLE_HEADING = "## Current deployment, Creditcoin testnet (102031)"


def _short(tx: str) -> str:
    return f"{tx[:10]}\u2026{tx[-6:]}"


def rewrite_table_row(text: str, key: str, address: str, tx: str | None, block: str | None) -> str:
    """Point the table's row for `key` at `address`, keeping its description column."""
    name = TABLE_NAMES.get(key)
    if not name:
        return text
    pattern = re.compile(rf"^\| `{re.escape(name)}` \|.*$", re.MULTILINE)
    found = pattern.search(text)
    if not found:
        print(f"  {name} has no row in the current table; not inventing one")
        return text

    columns = [c.strip() for c in found.group(0).strip().strip("|").split("|")]
    # Contract, Address, Deploy tx, Block, What it is. The last column is prose worth keeping.
    what = columns[4] if len(columns) >= 5 else ""
    tx_cell = f"[`{_short(tx)}`]({BLOCKSCOUT}/tx/{tx})" if tx else (columns[2] if len(columns) > 2 else "-")
    block_cell = block or (columns[3] if len(columns) > 3 else "-")
    row = f"| `{name}` | [`{address}`]({BLOCKSCOUT}/address/{address}) | {tx_cell} | {block_cell} | {what} |"
    print(f"  and rewrote its row in the current table")
    return pattern.sub(lambda _: row, text, count=1)


def table_body(text: str) -> str:
    """The Current deployment section, which is what a human actually reads."""
    start = text.index(TABLE_HEADING)
    nxt = text.find("\n## ", start + 1)
    return text[start : nxt if nxt != -1 else len(text)]


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
    promoted: list[tuple[str, str]] = []
    for key in keys:
        want = book.get(f"{prefix}{key}")
        if not want:
            print(f"{prefix}{key} is not in the address book", file=sys.stderr)
            return 1
        had = book.get(key)
        if had and had.lower() == want.lower():
            # The key is right. The table may still not be: that is how the arena promotion went wrong, and
            # a run that says "already correct" and leaves a stale row is how it stayed wrong.
            print(f"{key} already points at {want}")
            text = rewrite_table_row(
                text, key, want, book.get(f"{prefix}{key}_TX"), book.get(f"{prefix}{key}_BLOCK")
            )
            promoted.append((key, want))
            continue
        if had:
            superseded.append((key, had))
        print(f"{key}: {had or 'ABSENT'} -> {want}")
        pattern = re.compile(rf"^{re.escape(key)}=.*$", re.MULTILINE)
        text = pattern.sub(f"{key}={want}", text, count=1) if pattern.search(text) else (
            text.rstrip("\n") + f"\n{key}={want}\n"
        )
        text = rewrite_table_row(
            text, key, want, book.get(f"{prefix}{key}_TX"), book.get(f"{prefix}{key}_BLOCK")
        )
        promoted.append((key, want))

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

    # The table is the half a human reads. A promotion that updates the key block and leaves the
    # table naming a superseded contract is the exact failure this check exists for.
    body = table_body(text)
    stale = [key for key, address in promoted if key in TABLE_NAMES and address not in body]
    if stale:
        for key in stale:
            print(f"REFUSING: {key} is promoted but its address is not in the current table", file=sys.stderr)
        return 1

    if write:
        ADDRESSES.write_text(text)
        print(f"\n{len(promoted)} key(s) promoted, {len(superseded)} superseded recorded")
    else:
        print(f"\n{len(promoted)} key(s) would change; re-run with --write")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
