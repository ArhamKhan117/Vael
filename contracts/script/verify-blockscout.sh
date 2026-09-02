#!/usr/bin/env bash
#
# Submit every baseline contract to Blockscout for source verification.
#
# Reads addresses from docs/ADDRESSES.md and needs no private key: verification is a source
# upload, not a transaction. Safe to re-run; Blockscout reports an already-verified contract
# rather than failing.
#
#   set -a; source contracts/.env; set +a
#   ./script/verify-blockscout.sh
#
set -euo pipefail

CONTRACTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ADDRESSES_FILE="$CONTRACTS_DIR/../docs/ADDRESSES.md"

CHAIN_ID=102031
VERIFIER_URL="https://creditcoin-testnet.blockscout.com/api/"

: "${DEPLOYER_ADDRESS:?DEPLOYER_ADDRESS is not set. Source contracts/.env first.}"

lookup() { grep -E "^${1}=" "$ADDRESSES_FILE" | tail -1 | cut -d= -f2-; }

IDENTITY="$(lookup IDENTITY_REGISTRY_ADDRESS)"
REPUTATION="$(lookup REPUTATION_REGISTRY_ADDRESS)"
VALIDATION="$(lookup VALIDATION_REGISTRY_ADDRESS)"
ADAPTER="$(lookup AGENT_REGISTRY_ADAPTER_ADDRESS)"
TOKEN="$(lookup VAEL_TOKEN_ADDRESS)"
VAULT="$(lookup REWARD_VAULT_ADDRESS)"
BADGE="$(lookup BADGE_NFT_ADDRESS)"
MANAGER="$(lookup QUEST_MANAGER_ADDRESS)"
ESCROW="$(lookup CAMPAIGN_ESCROW_ADDRESS)"
HERO="$(lookup VAEL_HERO_ADDRESS)"
RAID="$(lookup RAID_BOSS_ADDRESS)"
ARENA="$(lookup ARENA_ADDRESS)"
LOOT="$(lookup LOOT_ADDRESS)"
EQUIPMENT="$(lookup EQUIPMENT_ADDRESS)"
MARKET="$(lookup MARKETPLACE_ADDRESS)"
ASC="$(lookup QUEST_ASC_ADDRESS)"
A_PORTAL="$(lookup PORTAL_ADAPTER_ADDRESS)"
A_ERC20="$(lookup ERC20_TRANSFER_ADAPTER_ADDRESS)"
A_UNI="$(lookup UNISWAP_V3_ADAPTER_ADDRESS)"
A_AAVE="$(lookup AAVE_V3_ADAPTER_ADDRESS)"

# submit ADDRESS PATH:NAME ENCODED_CONSTRUCTOR_ARGS
submit() {
  local address="$1" what="$2" args="$3"
  printf '\n==> %s  %s\n' "${what#*:}" "$address"
  local flags=(--verifier blockscout --verifier-url "$VERIFIER_URL" --chain-id "$CHAIN_ID")
  [ -n "$args" ] && flags+=(--constructor-args "$args")
  forge verify-contract "$address" "$what" "${flags[@]}" 2>&1 \
    | grep -E "Response|GUID|already verified|Error|error" || true
}

submit "$IDENTITY"   src/erc8004/IdentityRegistry.sol:IdentityRegistry \
  "$(cast abi-encode 'constructor(address)' "$DEPLOYER_ADDRESS")"

submit "$REPUTATION" src/erc8004/ReputationRegistry.sol:ReputationRegistry \
  "$(cast abi-encode 'constructor(address,address)' "$DEPLOYER_ADDRESS" "$IDENTITY")"

submit "$VALIDATION" src/erc8004/ValidationRegistry.sol:ValidationRegistry \
  "$(cast abi-encode 'constructor(address,address)' "$DEPLOYER_ADDRESS" "$IDENTITY")"

submit "$ADAPTER"    src/erc8004/AgentRegistryAdapter.sol:AgentRegistryAdapter \
  "$(cast abi-encode 'constructor(address)' "$IDENTITY")"

submit "$TOKEN"      src/tokens/VaelToken.sol:VaelToken \
  "$(cast abi-encode 'constructor(address)' "$DEPLOYER_ADDRESS")"

submit "$VAULT"      src/RewardVault.sol:RewardVault \
  "$(cast abi-encode 'constructor(address)' "$DEPLOYER_ADDRESS")"

submit "$BADGE"      src/BadgeNFT.sol:BadgeNFT \
  "$(cast abi-encode 'constructor(address)' "$DEPLOYER_ADDRESS")"

[ -n "$HERO" ] && submit "$HERO" src/game/VaelHero.sol:VaelHero \
  "$(cast abi-encode 'constructor(address)' "$DEPLOYER_ADDRESS")"

submit "$MANAGER"    src/QuestManager.sol:QuestManager \
  "$(cast abi-encode 'constructor(address,address,address,address,address,address)' \
     "$DEPLOYER_ADDRESS" "$ADAPTER" "$VAULT" "$BADGE" "$REPUTATION" "$VALIDATION")"

submit "$ESCROW"     src/CampaignEscrow.sol:CampaignEscrow \
  "$(cast abi-encode 'constructor(address)' "$DEPLOYER_ADDRESS")"

[ -n "$ASC" ] && submit "$ASC" src/QuestASC.sol:QuestASC \
  "$(cast abi-encode 'constructor(address,address)' "$DEPLOYER_ADDRESS" "$MANAGER")"

[ -n "$RAID" ] && submit "$RAID" src/game/RaidBoss.sol:RaidBoss \
  "$(cast abi-encode 'constructor(address,address,address,address)' \
     "$DEPLOYER_ADDRESS" "$TOKEN" "$HERO" "$BADGE")"

# The adapters carry no constructor argument except the Uniswap one, which takes an owner.
[ -n "$A_PORTAL" ] && submit "$A_PORTAL" src/adapters/PortalAdapter.sol:PortalAdapter ""
[ -n "$A_ERC20" ] && submit "$A_ERC20" src/adapters/Erc20TransferAdapter.sol:Erc20TransferAdapter ""
[ -n "$A_UNI" ] && submit "$A_UNI" src/adapters/UniswapV3SwapAdapter.sol:UniswapV3SwapAdapter \
  "$(cast abi-encode 'constructor(address)' "$DEPLOYER_ADDRESS")"
[ -n "$A_AAVE" ] && submit "$A_AAVE" src/adapters/AaveV3Adapter.sol:AaveV3Adapter ""

# milestone 6 modules. Each is standalone, so each constructor names only what it reads.
[ -n "$ARENA" ] && submit "$ARENA" src/game/Arena.sol:Arena \
  "$(cast abi-encode 'constructor(address,address,address)' "$DEPLOYER_ADDRESS" "$TOKEN" "$HERO")"

[ -n "$LOOT" ] && submit "$LOOT" src/game/Loot.sol:Loot \
  "$(cast abi-encode 'constructor(address,address)' "$DEPLOYER_ADDRESS" "$RAID")"

[ -n "$EQUIPMENT" ] && submit "$EQUIPMENT" src/game/Equipment.sol:Equipment \
  "$(cast abi-encode 'constructor(address,address)' "$HERO" "$LOOT")"

[ -n "$MARKET" ] && submit "$MARKET" src/game/Marketplace.sol:Marketplace \
  "$(cast abi-encode 'constructor(address,address,address,address)' \
     "$DEPLOYER_ADDRESS" "$TOKEN" "$LOOT" "$DEPLOYER_ADDRESS")"

# A submission returning OK does not mean the contract ended up verified: QuestASC v3 was
# accepted and stayed unverified, and nothing noticed because the submit output looked fine.
# Always finish by asking the explorer what it actually holds.
printf '\nWaiting for the explorer to publish, then checking what it actually holds\n'
sleep 25
exec "$CONTRACTS_DIR/script/check-verification.sh"
