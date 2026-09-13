#!/usr/bin/env bash
#
# Smoke test of a fresh core deployment. Pure `cast`, no API and no web app.
#
# Proves three things against the live Creditcoin deployment:
#   1. the registered ERC-8004 agent can create a quest, and the reward vault funds it
#   2. the assigned participant can accept it, and QuestAccepted lands in the logs
#   3. recordCompletion from the deployer REVERTS with QuestManager__OnlyQuestASC
#
# Point 3 is the whole security claim of the project. If it ever stops reverting, a backend
# key can pay itself and the design is broken.
#
#   set -a; source contracts/.env; set +a
#   ./script/smoke-baseline.sh
#   unset DEPLOYER_PRIVATE_KEY
#
set -euo pipefail

CONTRACTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ADDRESSES_FILE="$CONTRACTS_DIR/../docs/ADDRESSES.md"

EXPECTED_CHAIN_ID=102031
PLACEHOLDER_URI="ipfs://placeholder"
REWARD_VAEL=100
BADGE_LEVEL=1
CATEGORY=0   # QuestCategory.Swap
# Uniswap v3 SwapRouter02 on Sepolia, recorded for reference only. Nothing on Creditcoin
# calls it; the real emitter allowlist lives in QuestASC.
PROTOCOL="0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E"

QUEST_ACCEPTED_TOPIC="0x7d422f3e3149564cf96cfeab23ae433b6b1d7259c2873096244209f9b40befee"
ONLY_QUEST_ASC_SELECTOR="0xe2a34f59"

: "${CREDITCOIN_RPC_URL:?CREDITCOIN_RPC_URL is not set. Source contracts/.env first.}"
: "${DEPLOYER_PRIVATE_KEY:?DEPLOYER_PRIVATE_KEY is not set. Source contracts/.env first.}"
: "${DEPLOYER_ADDRESS:?DEPLOYER_ADDRESS is not set. Source contracts/.env first.}"

RPC=(--rpc-url "$CREDITCOIN_RPC_URL")

log()  { printf '\n\033[1m==> %s\033[0m\n' "$*" >&2; }
info() { printf '    %s\n' "$*" >&2; }
pass() { printf '    \033[32mPASS\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[31mFATAL: %s\033[0m\n' "$*" >&2; exit 1; }

json_get() {
  python3 -c 'import json,sys; print(json.load(sys.stdin).get(sys.argv[1], ""))' "$1"
}

lookup() { grep -E "^${1}=" "$ADDRESSES_FILE" | tail -1 | cut -d= -f2-; }

# Token amounts are 18-decimal and overflow bash's 64-bit signed arithmetic, so every
# balance comparison goes through python3.
balance_of() {
  cast call "$1" "balanceOf(address)(uint256)" "$2" "${@:3}" "${RPC[@]}" | awk '{print $1}'
}
big_diff() { python3 -c 'import sys; print(int(sys.argv[1]) - int(sys.argv[2]))' "$1" "$2"; }

actual_chain_id="$(cast chain-id "${RPC[@]}")"
[ "$actual_chain_id" = "$EXPECTED_CHAIN_ID" ] \
  || die "connected to chain $actual_chain_id, expected $EXPECTED_CHAIN_ID"

QUEST_MANAGER="$(lookup QUEST_MANAGER_ADDRESS)"
REWARD_VAULT="$(lookup REWARD_VAULT_ADDRESS)"
VAEL_TOKEN="$(lookup VAEL_TOKEN_ADDRESS)"
[ -n "$QUEST_MANAGER" ] || die "QUEST_MANAGER_ADDRESS missing from $ADDRESSES_FILE"

log "Smoke test against Creditcoin testnet $EXPECTED_CHAIN_ID"
info "QuestManager  $QUEST_MANAGER"
info "agent         $DEPLOYER_ADDRESS (id $(lookup AGENT_ID))"

# send DESCRIPTION TARGET SIG ARGS... - one transaction; echoes "hash block" on stdout.
send() {
  local desc="$1" target="$2" sig="$3"; shift 3
  local out hash status gas_used gas_limit block
  out="$(cast send "$target" "$sig" "$@" \
        --private-key "$DEPLOYER_PRIVATE_KEY" "${RPC[@]}" --json)"
  hash="$(printf '%s' "$out" | json_get transactionHash)"
  status="$(printf '%s' "$out" | json_get status)"
  gas_used=$(( $(printf '%s' "$out" | json_get gasUsed) ))
  block=$(( $(printf '%s' "$out" | json_get blockNumber) ))
  gas_limit=$(( $(cast tx "$hash" gas "${RPC[@]}") ))

  [ "$status" = "0x1" ] || [ "$status" = "1" ] || die "$desc reverted (tx $hash)"
  # An exhausted gas limit is indistinguishable from a revert on this chain.
  [ "$gas_used" -lt "$gas_limit" ] \
    || die "$desc consumed its entire gas limit ($gas_used/$gas_limit), treat as failed"

  info "$desc"
  info "  tx       $hash"
  info "  block    $block"
  info "  gas      $gas_used used / $gas_limit limit  ($(( gas_used * 100 / gas_limit ))%)"
  printf '%s %s' "$hash" "$block"
}

# ------------------------------------------------------------------ 1. create

log "1. Create a quest as the registered agent"

reward_wei="$(cast to-wei "$REWARD_VAEL")"
params_hash="$(cast keccak "vael-smoke-$(date +%s)")"
vault_before="$(balance_of "$VAEL_TOKEN" "$REWARD_VAULT")"

result="$(send "QuestManager.createQuest" "$QUEST_MANAGER" \
  "createQuest((uint8,address,bytes32,string,uint256,uint64,uint256,address))" \
  "($CATEGORY,$PROTOCOL,$params_hash,$PLACEHOLDER_URI,$reward_wei,0,$BADGE_LEVEL,$DEPLOYER_ADDRESS)")"
create_tx="${result% *}"; create_block="${result#* }"

# The quest id is topics[1] of QuestCreated in this transaction's own receipt.
quest_id="$(cast receipt "$create_tx" "${RPC[@]}" --json \
  | python3 -c '
import json, sys
receipt = json.load(sys.stdin)
target = sys.argv[1].lower()
for entry in receipt["logs"]:
    if entry["address"].lower() == target and len(entry["topics"]) > 1:
        print(int(entry["topics"][1], 16)); break
else:
    raise SystemExit("no QuestCreated log found")' "$QUEST_MANAGER")"
[ -n "$quest_id" ] || die "could not read the quest id from the receipt"
info "  questId  $quest_id"

vault_after="$(balance_of "$VAEL_TOKEN" "$REWARD_VAULT" --block "$create_block")"
minted="$(big_diff "$vault_after" "$vault_before")"
[ "$minted" = "$reward_wei" ] \
  || die "reward vault gained $minted wei, expected $reward_wei"
pass "RewardVault minted $REWARD_VAEL VAEL for quest $quest_id"

status_value="$(cast call "$QUEST_MANAGER" "getQuest(uint256)((uint256,address,uint8,address,bytes32,string,address,uint256,uint256,address,uint32,uint32,uint64,uint8,uint64))" \
  "$quest_id" --block "$create_block" "${RPC[@]}")"
info "  quest struct read back at block $create_block"

# ------------------------------------------------------------------ 2. accept

log "2. Accept the quest as the assigned participant"

result="$(send "QuestManager.acceptQuest($quest_id)" "$QUEST_MANAGER" "acceptQuest(uint256)" "$quest_id")"
accept_tx="${result% *}"; accept_block="${result#* }"

# QuestAccepted must appear in this transaction's logs, from QuestManager, with the quest
# id in topics[1] and the participant in topics[2].
cast receipt "$accept_tx" "${RPC[@]}" --json | python3 -c '
import json, sys
receipt = json.load(sys.stdin)
manager, topic0, quest_id, participant = (a.lower() for a in sys.argv[1:5])
for entry in receipt["logs"]:
    if entry["address"].lower() != manager:
        continue
    topics = entry["topics"]
    if topics[0].lower() != topic0:
        continue
    if int(topics[1], 16) != int(quest_id) or int(topics[2], 16) != int(participant, 16):
        continue
    print(f"    QuestAccepted questId={int(topics[1], 16)} participant=0x{topics[2][-40:]}")
    break
else:
    raise SystemExit("QuestAccepted not found in the accept receipt")
' "$QUEST_MANAGER" "$QUEST_ACCEPTED_TOPIC" "$quest_id" "$DEPLOYER_ADDRESS" >&2
pass "QuestAccepted emitted in block $accept_block"

progress="$(cast call "$QUEST_MANAGER" "participantProgress(uint256,address)((bool,bool))" \
  "$quest_id" "$DEPLOYER_ADDRESS" --block "$accept_block" "${RPC[@]}")"
info "  participantProgress (accepted, completed) = $progress"
case "$progress" in
  *true*false*) pass "accepted=true completed=false" ;;
  *) die "unexpected participant progress: $progress" ;;
esac

# ------------------------------------------------------------------ 3. the point

log "3. recordCompletion must be refused: only QuestASC may complete a quest"

quest_asc="$(cast call "$QUEST_MANAGER" "questASC()(address)" "${RPC[@]}")"
[ "$quest_asc" = "0x0000000000000000000000000000000000000000" ] \
  || die "questASC is already bound to $quest_asc, this smoke test assumes a core without it"
info "  questASC is unset, so no address on earth may complete a quest"

# eth_call, so this costs nothing and cannot accidentally succeed on-chain.
set +e
revert_output="$(cast call "$QUEST_MANAGER" \
  "recordCompletion(uint256,address,string)" \
  "$quest_id" "$DEPLOYER_ADDRESS" "$PLACEHOLDER_URI" \
  --from "$DEPLOYER_ADDRESS" "${RPC[@]}" 2>&1)"
call_status=$?
set -e

[ "$call_status" -ne 0 ] \
  || die "recordCompletion SUCCEEDED from the deployer. The trusted-key path is open."

printf '%s' "$revert_output" | grep -qi "$ONLY_QUEST_ASC_SELECTOR\|OnlyQuestASC" \
  || die "recordCompletion reverted, but not with QuestManager__OnlyQuestASC: $revert_output"

pass "recordCompletion reverted with QuestManager__OnlyQuestASC ($ONLY_QUEST_ASC_SELECTOR)"

# ------------------------------------------------------------------ summary

log "Smoke test passed"
info "questId     $quest_id"
info "create tx   $create_tx"
info "accept tx   $accept_tx"
info "No backend key can complete a quest. Only QuestASC will, once bound."
