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

submit "$MANAGER"    src/QuestManager.sol:QuestManager \
  "$(cast abi-encode 'constructor(address,address,address,address,address,address)' \
     "$DEPLOYER_ADDRESS" "$ADAPTER" "$VAULT" "$BADGE" "$REPUTATION" "$VALIDATION")"

submit "$ESCROW"     src/CampaignEscrow.sol:CampaignEscrow \
  "$(cast abi-encode 'constructor(address)' "$DEPLOYER_ADDRESS")"

printf '\nSubmitted. Poll status with script/check-verification.sh\n'
