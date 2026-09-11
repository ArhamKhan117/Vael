#!/usr/bin/env bash
#
# Poll Blockscout for the source-verification status of every deployed contract.
#
# It asks the explorer what it actually holds, rather than trusting the `OK` that
# `forge verify-contract` prints on submission. That response only means the request was
# accepted: a submission can be accepted and still end up unverified, which is exactly what
# happened to QuestASC v3 and went unnoticed because the submit output looked fine.
#
# Read-only, no key. Exits non-zero if anything is unverified.
#
set -uo pipefail

ADDRESSES_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/docs/ADDRESSES.md"
CREDITCOIN="https://creditcoin-testnet.blockscout.com"
SEPOLIA="https://eth-sepolia.blockscout.com"

# name:address-key:explorer
TARGETS=(
  "IdentityRegistry:IDENTITY_REGISTRY_ADDRESS:$CREDITCOIN"
  "ReputationRegistry:REPUTATION_REGISTRY_ADDRESS:$CREDITCOIN"
  "ValidationRegistry:VALIDATION_REGISTRY_ADDRESS:$CREDITCOIN"
  "AgentRegistryAdapter:AGENT_REGISTRY_ADAPTER_ADDRESS:$CREDITCOIN"
  "VaelToken:VAEL_TOKEN_ADDRESS:$CREDITCOIN"
  "RewardVault:REWARD_VAULT_ADDRESS:$CREDITCOIN"
  "BadgeNFT:BADGE_NFT_ADDRESS:$CREDITCOIN"
  "QuestManager:QUEST_MANAGER_ADDRESS:$CREDITCOIN"
  "CampaignEscrow:CAMPAIGN_ESCROW_ADDRESS:$CREDITCOIN"
  "QuestASC:QUEST_ASC_ADDRESS:$CREDITCOIN"
  "NativePortal:NATIVE_PORTAL_ADDRESS:$CREDITCOIN"
  "CampaignPayoutHook:CAMPAIGN_PAYOUT_HOOK_ADDRESS:$CREDITCOIN"
  "EvmV1Decoder:EVM_V1_DECODER_LIBRARY_ADDRESS:$CREDITCOIN"
  "PortalAdapter:PORTAL_ADAPTER_ADDRESS:$CREDITCOIN"
  "Erc20TransferAdapter:ERC20_TRANSFER_ADAPTER_ADDRESS:$CREDITCOIN"
  "UniswapV3SwapAdapter:UNISWAP_V3_ADAPTER_ADDRESS:$CREDITCOIN"
  "AaveV3Adapter:AAVE_V3_ADAPTER_ADDRESS:$CREDITCOIN"
  "VaelHero:VAEL_HERO_ADDRESS:$CREDITCOIN"
  "RaidBoss:RAID_BOSS_ADDRESS:$CREDITCOIN"
  "Arena:ARENA_ADDRESS:$CREDITCOIN"
  "Loot:LOOT_ADDRESS:$CREDITCOIN"
  "Equipment:EQUIPMENT_ADDRESS:$CREDITCOIN"
  "Marketplace:MARKETPLACE_ADDRESS:$CREDITCOIN"
  "QuestPortal:QUEST_PORTAL_ADDRESS:$SEPOLIA"
)

lookup() { grep -E "^${1}=" "$ADDRESSES_FILE" 2>/dev/null | tail -1 | cut -d= -f2- || true; }

unverified=0
for target in "${TARGETS[@]}"; do
  name="${target%%:*}"
  rest="${target#*:}"
  key="${rest%%:*}"
  base="${rest#*:}"                   # the explorer URL, which contains colons of its own
  address="$(lookup "$key")"
  if [ -z "$address" ]; then
    printf '%-24s %-44s %s\n' "$name" "-" "not deployed"
    continue
  fi
  status="$(curl -fsS "$base/api/v2/smart-contracts/$address" 2>/dev/null \
    | python3 -c 'import json,sys
try:
    d = json.load(sys.stdin)
except Exception:
    print("no-source"); raise SystemExit
print("verified" if d.get("is_verified") else "unverified")' 2>/dev/null || echo "no-source")"
  printf '%-24s %-44s %s\n' "$name" "$address" "$status"
  [ "$status" = "verified" ] || unverified=$((unverified + 1))
done

printf '\n%s contract(s) not verified\n' "$unverified"
exit $(( unverified > 0 ? 1 : 0 ))
