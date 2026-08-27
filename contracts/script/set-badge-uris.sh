#!/usr/bin/env bash
#
# Point every badge level at its pinned metadata document.
#
# The badge levels were wired at milestone 2 with `ipfs://placeholder`, which meant every badge a
# player earned resolved to nothing. The real documents are pinned by
# `pnpm --filter @vael/api pin-badges`, which writes apps/api/scripts/badge-cids.json; this reads
# that file and calls setBadgeURI once per level, reading each slot back at the block it landed in.
#
# Idempotent: a level whose on-chain URI already matches the manifest is skipped.
#
set -euo pipefail

CONTRACTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ADDRESSES_FILE="$CONTRACTS_DIR/../docs/ADDRESSES.md"
CIDS_FILE="$CONTRACTS_DIR/../apps/api/scripts/badge-cids.json"
EXPECTED_CHAIN_ID=102031

: "${CREDITCOIN_RPC_URL:?not set}"; : "${DEPLOYER_PRIVATE_KEY:?not set}"
RPC=(--rpc-url "$CREDITCOIN_RPC_URL")

log()  { printf '\n\033[1m==> %s\033[0m\n' "$*" >&2; }
info() { printf '    %s\n' "$*" >&2; }
die()  { printf '\033[31mFATAL: %s\033[0m\n' "$*" >&2; exit 1; }
json_get() { python3 -c 'import json,sys; print(json.load(sys.stdin).get(sys.argv[1], ""))' "$1"; }
lookup() { grep -E "^${1}=" "$ADDRESSES_FILE" 2>/dev/null | tail -1 | cut -d= -f2- || true; }

[ -f "$CIDS_FILE" ] || die "$CIDS_FILE is missing; run pnpm --filter @vael/api pin-badges first"
[ "$(cast chain-id "${RPC[@]}")" = "$EXPECTED_CHAIN_ID" ] || die "wrong chain"

BADGE="$(lookup BADGE_NFT_ADDRESS)"
[ -n "$BADGE" ] || die "BADGE_NFT_ADDRESS not found in $ADDRESSES_FILE"
log "BadgeNFT $BADGE"

levels="$(python3 -c '
import json, sys
doc = json.load(open(sys.argv[1]))
for badge in doc["badges"]:
    print(badge["level"], badge["metadataCid"], badge["name"])
' "$CIDS_FILE")"

while read -r level cid name; do
  [ -n "$level" ] || continue
  uri="ipfs://$cid"
  current="$(cast call "$BADGE" 'badgeURI(uint256)(string)' "$level" "${RPC[@]}" | tr -d '"')"
  if [ "$current" = "$uri" ]; then
    info "level $level ($name) already points at $uri"
    continue
  fi

  out="$(cast send "$BADGE" 'setBadgeURI(uint256,string)' "$level" "$uri" \
    --private-key "$DEPLOYER_PRIVATE_KEY" "${RPC[@]}" --json)"
  hash="$(printf '%s' "$out" | json_get transactionHash)"
  status="$(printf '%s' "$out" | json_get status)"
  block=$(( $(printf '%s' "$out" | json_get blockNumber) ))
  gas_used=$(( $(printf '%s' "$out" | json_get gasUsed) ))
  gas_limit=$(( $(cast tx "$hash" gas "${RPC[@]}") ))
  [ "$status" = "0x1" ] || [ "$status" = "1" ] || die "level $level reverted (tx $hash)"
  [ "$gas_used" -lt "$gas_limit" ] || die "level $level exhausted its gas limit ($gas_used/$gas_limit)"

  got="$(cast call "$BADGE" 'badgeURI(uint256)(string)' "$level" --block "$block" "${RPC[@]}" | tr -d '"')"
  [ "$got" = "$uri" ] || die "level $level: expected $uri, chain says $got (block $block)"
  info "level $level ($name) -> $uri  tx $hash  block $block  gas $gas_used/$gas_limit"
done <<< "$levels"

log "All badge levels point at pinned metadata"
