#!/usr/bin/env bash
#
# Poll Blockscout for the source-verification status of every baseline contract.
# Read-only, no key. Prints one line per contract, and exits non-zero if any is unverified.
#
set -uo pipefail

ADDRESSES_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/docs/ADDRESSES.md"
BASE="https://creditcoin-testnet.blockscout.com"

NAMES=(IDENTITY_REGISTRY REPUTATION_REGISTRY VALIDATION_REGISTRY AGENT_REGISTRY_ADAPTER
       VAEL_TOKEN REWARD_VAULT BADGE_NFT QUEST_MANAGER CAMPAIGN_ESCROW)

unverified=0
for name in "${NAMES[@]}"; do
  address="$(grep -E "^${name}_ADDRESS=" "$ADDRESSES_FILE" | tail -1 | cut -d= -f2-)"
  [ -n "$address" ] || { printf '%-24s MISSING FROM ADDRESS BOOK\n' "$name"; unverified=$((unverified+1)); continue; }
  status="$(curl -fsS "$BASE/api/v2/smart-contracts/$address" 2>/dev/null \
    | python3 -c 'import json,sys
try:
    d = json.load(sys.stdin)
except Exception:
    print("no-source"); raise SystemExit
print("verified" if d.get("is_verified") else "unverified")' 2>/dev/null || echo "unreachable")"
  printf '%-24s %-44s %s\n' "$name" "$address" "$status"
  [ "$status" = "verified" ] || unverified=$((unverified+1))
done

printf '\n%s\n' "$unverified contract(s) not verified"
exit $(( unverified > 0 ? 1 : 0 ))
