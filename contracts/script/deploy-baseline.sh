#!/usr/bin/env bash
#
# milestone 2 baseline deployment to Creditcoin testnet.
#
# The Creditcoin RPC returns block objects without mixHash, so `forge script --broadcast`
# fails after the first transaction it sends (docs/SPEC.md section 3.2). Every step here is
# therefore exactly one transaction: `forge create` per contract, `cast send` per wiring
# call, and a `cast call` read-back pinned to the block the write landed in.
#
# Idempotent: any step whose address or state is already recorded in docs/ADDRESSES.md is
# skipped, so a partial run can be resumed by running the script again.
#
# DEPLOYER_PRIVATE_KEY is read from the environment only and is never echoed, logged, or
# passed on a visible command line beyond forge/cast's own --private-key argument.
#
#   set -a; source contracts/.env; set +a
#   ./script/deploy-baseline.sh
#   unset DEPLOYER_PRIVATE_KEY
#
set -euo pipefail

CONTRACTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$CONTRACTS_DIR/.." && pwd)"
ADDRESSES_FILE="$REPO_ROOT/docs/ADDRESSES.md"

EXPECTED_CHAIN_ID=102031
EXPLORER="https://creditcoin-testnet.blockscout.com"
PLACEHOLDER_URI="ipfs://placeholder"
BADGE_LEVELS=(1 2 3 4 5 6 7 8 9 10)
# Initial treasury supply minted to the deployer, and the slice parked in the vault.
INITIAL_SUPPLY_ETHER=1000000
VAULT_BUFFER_ETHER=100000

MINTER_ROLE="0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6"

# ---------------------------------------------------------------- preconditions

: "${CREDITCOIN_RPC_URL:?CREDITCOIN_RPC_URL is not set. Source contracts/.env first.}"
: "${DEPLOYER_PRIVATE_KEY:?DEPLOYER_PRIVATE_KEY is not set. Source contracts/.env first.}"
: "${DEPLOYER_ADDRESS:?DEPLOYER_ADDRESS is not set. Source contracts/.env first.}"

RPC=(--rpc-url "$CREDITCOIN_RPC_URL")

# json_get FIELD — read one top-level field from JSON on stdin. Uses python3 rather than
# jq, which is not installed on this machine and must not be added silently.
json_get() {
  python3 -c 'import json,sys; print(json.load(sys.stdin).get(sys.argv[1], ""))' "$1"
}

# Narration always goes to stderr: several of these helpers run inside $(...) captures.
log()  { printf '\n\033[1m==> %s\033[0m\n' "$*" >&2; }
info() { printf '    %s\n' "$*" >&2; }
die()  { printf '\033[31mFATAL: %s\033[0m\n' "$*" >&2; exit 1; }

actual_chain_id="$(cast chain-id "${RPC[@]}")"
[ "$actual_chain_id" = "$EXPECTED_CHAIN_ID" ] \
  || die "connected to chain $actual_chain_id, refusing to deploy anywhere but $EXPECTED_CHAIN_ID"

# Guard against a key/address mismatch before spending anything.
derived="$(cast wallet address --private-key "$DEPLOYER_PRIVATE_KEY")"
[ "${derived,,}" = "${DEPLOYER_ADDRESS,,}" ] \
  || die "DEPLOYER_PRIVATE_KEY does not correspond to DEPLOYER_ADDRESS"

log "Creditcoin testnet $EXPECTED_CHAIN_ID"
info "deployer  $DEPLOYER_ADDRESS"
info "balance   $(cast balance "$DEPLOYER_ADDRESS" "${RPC[@]}" --ether) tCTC"
info "block     $(cast block-number "${RPC[@]}")"

mkdir -p "$(dirname "$ADDRESSES_FILE")"
if [ ! -f "$ADDRESSES_FILE" ]; then
  cat > "$ADDRESSES_FILE" <<'HEADER'
# Deployed addresses

All Vael game state lives on Creditcoin testnet (chain id 102031).
Ethereum Sepolia (11155111) carries only the source actions players prove.

Every address below was read back from the chain with `cast call` at the block its write
landed in. Regenerate or extend this file with `contracts/script/deploy-baseline.sh`, and
re-assert every wired slot with `contracts/script/VerifyBaseline.s.sol`.

HEADER
fi

# ---------------------------------------------------------------- record keeping

# record KEY VALUE — append `KEY=VALUE` to the machine-readable block, once.
record() {
  local key="$1" value="$2"
  if ! grep -qE "^${key}=" "$ADDRESSES_FILE" 2>/dev/null; then
    printf '%s=%s\n' "$key" "$value" >> "$ADDRESSES_FILE"
  fi
}

# lookup KEY — echo a previously recorded value, empty if absent.
lookup() {
  grep -E "^${1}=" "$ADDRESSES_FILE" 2>/dev/null | tail -1 | cut -d= -f2- || true
}

# note TEXT — append a human-readable line.
note() { printf '%s\n' "$1" >> "$ADDRESSES_FILE"; }

# ---------------------------------------------------------------- primitives

# send DESCRIPTION TARGET SIG ARGS... — one transaction, reporting gas used vs limit.
# Echoes the transaction hash on stdout; all narration goes to stderr.
send() {
  local desc="$1" target="$2" sig="$3"; shift 3
  local out hash status gas_used gas_limit block
  out="$(cast send "$target" "$sig" "$@" \
        --private-key "$DEPLOYER_PRIVATE_KEY" "${RPC[@]}" --json)"
  hash="$(printf '%s' "$out" | json_get transactionHash)"
  status="$(printf '%s' "$out" | json_get status)"
  gas_used="$(printf '%s' "$out" | json_get gasUsed)"
  block="$(printf '%s' "$out" | json_get blockNumber)"
  gas_limit="$(cast tx "$hash" gas "${RPC[@]}")"

  gas_used=$((gas_used)); gas_limit=$((gas_limit)); block=$((block))

  if [ "$status" != "0x1" ] && [ "$status" != "1" ]; then
    die "$desc reverted (tx $hash)"
  fi
  # An exhausted gas limit is indistinguishable from a revert on this chain, so compare.
  if [ "$gas_used" -ge "$gas_limit" ]; then
    die "$desc used its entire gas limit ($gas_used/$gas_limit), treat as failed (tx $hash)"
  fi
  info "$desc  tx $hash  block $block  gas $gas_used/$gas_limit"
  printf '%s %s' "$hash" "$block"
}

# deploy KEY CONTRACT_PATH:NAME [constructor args...]
deploy() {
  local key="$1" what="$2"; shift 2
  local existing; existing="$(lookup "$key")"
  if [ -n "$existing" ]; then
    info "$key already deployed at $existing, skipping"
    printf '%s' "$existing"
    return
  fi

  local out address hash block
  if [ $# -gt 0 ]; then
    out="$(forge create "$what" --private-key "$DEPLOYER_PRIVATE_KEY" "${RPC[@]}" \
           --broadcast --json --constructor-args "$@")"
  else
    out="$(forge create "$what" --private-key "$DEPLOYER_PRIVATE_KEY" "${RPC[@]}" \
           --broadcast --json)"
  fi
  address="$(printf '%s' "$out" | json_get deployedTo)"
  hash="$(printf '%s' "$out" | json_get transactionHash)"
  [ -n "$address" ] && [ "$address" != "null" ] || die "$key deployment produced no address"

  block="$(cast receipt "$hash" blockNumber "${RPC[@]}")"

  # Read the code back at the block the deployment landed in. `finalized` lags `latest` on
  # this chain, so pinning to that exact block is the only honest confirmation.
  local code_size
  code_size="$(cast code "$address" --block "$block" "${RPC[@]}" | wc -c)"
  [ "$code_size" -gt 4 ] || die "$key has no code at $address in block $block"

  info "$key deployed at $address  tx $hash  block $block  code ${code_size} chars"
  record "$key" "$address"
  record "${key}_TX" "$hash"
  record "${key}_BLOCK" "$block"
  printf '%s' "$address"
}

# expect_call DESCRIPTION TARGET SIG EXPECTED [BLOCK] [call args...]
expect_call() {
  local desc="$1" target="$2" sig="$3" expected="$4"
  local block="${5:-latest}"
  if [ $# -ge 5 ]; then shift 5; else shift $#; fi
  local got
  got="$(cast call "$target" "$sig" "$@" --block "$block" "${RPC[@]}")"
  # Normalise both sides: addresses come back zero-padded to 32 bytes.
  local got_norm exp_norm
  got_norm="$(printf '%s' "$got" | tr 'A-Z' 'a-z' | sed 's/^0x0*/0x/')"
  exp_norm="$(printf '%s' "$expected" | tr 'A-Z' 'a-z' | sed 's/^0x0*/0x/')"
  [ "$got_norm" = "$exp_norm" ] || die "$desc: expected $expected, chain says $got (block $block)"
  info "verified  $desc = $expected (block $block)"
}

# done KEY — true if this step is already recorded.
done_already() { [ -n "$(lookup "$1")" ]; }

# wire KEY DESC TARGET SEND_SIG SEND_ARGS READ_SIG EXPECTED READ_ARGS
#
# SEND_ARGS and READ_ARGS are single strings, word-split deliberately, because a setter and
# its getter rarely take the same arguments: `grantMinterRole(vault)` is read back with
# `hasRole(MINTER_ROLE, vault)`. Pass "" for none.
wire() {
  local key="$1" desc="$2" target="$3" send_sig="$4" send_args="$5" read_sig="$6" expected="$7" read_args="${8:-}"
  if done_already "$key"; then
    info "$desc already wired, skipping"
    return
  fi
  local result hash block
  # shellcheck disable=SC2086 — deliberate word splitting of the argument lists
  result="$(send "$desc" "$target" "$send_sig" $send_args)"
  hash="${result% *}"; block="${result#* }"
  # shellcheck disable=SC2086
  expect_call "$desc" "$target" "$read_sig" "$expected" "$block" $read_args
  record "$key" "$hash"
}

# ---------------------------------------------------------------- 1. deployments

log "Deploying contracts, one transaction each"

IDENTITY_REGISTRY="$(deploy IDENTITY_REGISTRY_ADDRESS \
  src/erc8004/IdentityRegistry.sol:IdentityRegistry "$DEPLOYER_ADDRESS")"

REPUTATION_REGISTRY="$(deploy REPUTATION_REGISTRY_ADDRESS \
  src/erc8004/ReputationRegistry.sol:ReputationRegistry "$DEPLOYER_ADDRESS" "$IDENTITY_REGISTRY")"

VALIDATION_REGISTRY="$(deploy VALIDATION_REGISTRY_ADDRESS \
  src/erc8004/ValidationRegistry.sol:ValidationRegistry "$DEPLOYER_ADDRESS" "$IDENTITY_REGISTRY")"

AGENT_REGISTRY_ADAPTER="$(deploy AGENT_REGISTRY_ADAPTER_ADDRESS \
  src/erc8004/AgentRegistryAdapter.sol:AgentRegistryAdapter "$IDENTITY_REGISTRY")"

VAEL_TOKEN="$(deploy VAEL_TOKEN_ADDRESS \
  src/tokens/VaelToken.sol:VaelToken "$DEPLOYER_ADDRESS")"

REWARD_VAULT="$(deploy REWARD_VAULT_ADDRESS \
  src/RewardVault.sol:RewardVault "$DEPLOYER_ADDRESS")"

BADGE_NFT="$(deploy BADGE_NFT_ADDRESS \
  src/BadgeNFT.sol:BadgeNFT "$DEPLOYER_ADDRESS")"

QUEST_MANAGER="$(deploy QUEST_MANAGER_ADDRESS \
  src/QuestManager.sol:QuestManager \
  "$DEPLOYER_ADDRESS" "$AGENT_REGISTRY_ADAPTER" "$REWARD_VAULT" "$BADGE_NFT" \
  "$REPUTATION_REGISTRY" "$VALIDATION_REGISTRY")"

CAMPAIGN_ESCROW="$(deploy CAMPAIGN_ESCROW_ADDRESS \
  src/CampaignEscrow.sol:CampaignEscrow "$DEPLOYER_ADDRESS")"

# QuestManager's collaborators are immutable, so assert them once against the deployments.
log "Asserting QuestManager immutables"
expect_call "QuestManager.AGENT_REGISTRY"      "$QUEST_MANAGER" "AGENT_REGISTRY()(address)"      "$AGENT_REGISTRY_ADAPTER"
expect_call "QuestManager.REWARD_VAULT"        "$QUEST_MANAGER" "REWARD_VAULT()(address)"        "$REWARD_VAULT"
expect_call "QuestManager.BADGE_NFT"           "$QUEST_MANAGER" "BADGE_NFT()(address)"           "$BADGE_NFT"
expect_call "QuestManager.REPUTATION_REGISTRY" "$QUEST_MANAGER" "REPUTATION_REGISTRY()(address)" "$REPUTATION_REGISTRY"
expect_call "QuestManager.VALIDATION_REGISTRY" "$QUEST_MANAGER" "VALIDATION_REGISTRY()(address)" "$VALIDATION_REGISTRY"

# ---------------------------------------------------------------- 2. wiring

log "Wiring, one transaction per call, each read back"

wire WIRE_VAULT_TOKEN_TX "RewardVault.setVaelToken" \
  "$REWARD_VAULT" "setVaelToken(address)" "$VAEL_TOKEN" \
  "vaelToken()(address)" "$VAEL_TOKEN" ""

wire WIRE_VAULT_MANAGER_TX "RewardVault.setQuestManager" \
  "$REWARD_VAULT" "setQuestManager(address)" "$QUEST_MANAGER" \
  "questManager()(address)" "$QUEST_MANAGER" ""

wire WIRE_BADGE_MANAGER_TX "BadgeNFT.setQuestManager" \
  "$BADGE_NFT" "setQuestManager(address)" "$QUEST_MANAGER" \
  "questManager()(address)" "$QUEST_MANAGER" ""

# RewardVault.fundQuest mints on demand, so the vault needs MINTER_ROLE on VaelToken.
wire WIRE_MINTER_ROLE_TX "VaelToken.grantMinterRole(RewardVault)" \
  "$VAEL_TOKEN" "grantMinterRole(address)" "$REWARD_VAULT" \
  "hasRole(bytes32,address)(bool)" "true" "$MINTER_ROLE $REWARD_VAULT"

wire WIRE_REPUTATION_AUTH_TX "ReputationRegistry.setReviewerAuthorization(QuestManager)" \
  "$REPUTATION_REGISTRY" "setReviewerAuthorization(address,bool)" "$QUEST_MANAGER true" \
  "isReviewerAuthorized(address)(bool)" "true" "$QUEST_MANAGER"

# QuestManager does not call the validation registry yet. Authorising it now keeps the
# milestone 3 validation path open without another owner transaction later.
wire WIRE_VALIDATION_AUTH_TX "ValidationRegistry.setValidatorAuthorization(QuestManager)" \
  "$VALIDATION_REGISTRY" "setValidatorAuthorization(address,bool)" "$QUEST_MANAGER true" \
  "isValidatorAuthorized(address)(bool)" "true" "$QUEST_MANAGER"

wire WIRE_ESCROW_TOKEN_TX "CampaignEscrow.setRewardToken(VaelToken)" \
  "$CAMPAIGN_ESCROW" "setRewardToken(address)" "$VAEL_TOKEN" \
  "rewardToken()(address)" "$VAEL_TOKEN" ""

# ---------------------------------------------------------------- 3. badge URIs

log "Badge URIs (placeholder until Pinata exists)"
for level in "${BADGE_LEVELS[@]}"; do
  key="WIRE_BADGE_URI_${level}_TX"
  if [ -n "$(lookup "$key")" ]; then
    info "badge URI level $level already set, skipping"
    continue
  fi
  result="$(send "BadgeNFT.setBadgeURI($level)" "$BADGE_NFT" \
            "setBadgeURI(uint256,string)" "$level" "$PLACEHOLDER_URI")"
  record "$key" "${result% *}"
done

# ---------------------------------------------------------------- 4. supply

log "Initial VAEL supply"

if [ -z "$(lookup MINT_INITIAL_SUPPLY_TX)" ]; then
  supply_wei="$(cast to-wei "$INITIAL_SUPPLY_ETHER")"
  result="$(send "VaelToken.mint(deployer, ${INITIAL_SUPPLY_ETHER} VAEL)" \
            "$VAEL_TOKEN" "mint(address,uint256)" "$DEPLOYER_ADDRESS" "$supply_wei")"
  record MINT_INITIAL_SUPPLY_TX "${result% *}"
  info "deployer VAEL balance: $(cast call "$VAEL_TOKEN" "balanceOf(address)(uint256)" "$DEPLOYER_ADDRESS" "${RPC[@]}")"
else
  info "initial supply already minted, skipping"
fi

if [ -z "$(lookup FUND_VAULT_TX)" ]; then
  buffer_wei="$(cast to-wei "$VAULT_BUFFER_ETHER")"
  result="$(send "VaelToken.transfer(RewardVault, ${VAULT_BUFFER_ETHER} VAEL)" \
            "$VAEL_TOKEN" "transfer(address,uint256)" "$REWARD_VAULT" "$buffer_wei")"
  record FUND_VAULT_TX "${result% *}"
  info "vault VAEL balance: $(cast call "$VAEL_TOKEN" "balanceOf(address)(uint256)" "$REWARD_VAULT" "${RPC[@]}")"
else
  info "vault already funded, skipping"
fi

# ---------------------------------------------------------------- 5. agent

log "Registering the deployer as the ERC-8004 quest agent"

agent_id="$(cast call "$IDENTITY_REGISTRY" "agentIdByController(address)(uint256)" \
            "$DEPLOYER_ADDRESS" "${RPC[@]}" | awk '{print $1}')"
if [ "$agent_id" = "0" ]; then
  result="$(send "IdentityRegistry.registerAgent(deployer)" "$IDENTITY_REGISTRY" \
            "registerAgent(address,string)" "$DEPLOYER_ADDRESS" "$PLACEHOLDER_URI")"
  record REGISTER_AGENT_TX "${result% *}"
  agent_id="$(cast call "$IDENTITY_REGISTRY" "agentIdByController(address)(uint256)" \
              "$DEPLOYER_ADDRESS" --block "${result#* }" "${RPC[@]}" | awk '{print $1}')"
  [ "$agent_id" != "0" ] || die "agent registration did not produce an agent id"
else
  info "deployer already registered as agent $agent_id, skipping"
fi
record AGENT_ID "$agent_id"
expect_call "IdentityRegistry.isActive($agent_id)" "$IDENTITY_REGISTRY" \
  "isActive(uint256)(bool)" "true" latest "$agent_id"

# ---------------------------------------------------------------- 6. one-shots stay unset

log "One-shot bindings deliberately left unset for milestone 3"
expect_call "QuestManager.questASC (must stay zero)" "$QUEST_MANAGER" \
  "questASC()(address)" "0x0000000000000000000000000000000000000000"
expect_call "CampaignEscrow.rewardReleaser (must stay zero)" "$CAMPAIGN_ESCROW" \
  "rewardReleaser()(address)" "0x0000000000000000000000000000000000000000"
info "QuestManager.setQuestASC and CampaignEscrow.setRewardReleaser wait for QuestASC."

log "Baseline deployment complete"
info "addresses recorded in $ADDRESSES_FILE"
info "explorer $EXPLORER"
