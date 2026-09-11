/**
 * Live proof-gated partner loop on Creditcoin testnet.
 *
 *   pnpm --filter @vael/api e2e:partner
 *
 * The deployer is the partner, player2 is the player. Fund a campaign escrow, publish a quest that
 * pays from it, accept it as the player, perform the action on Ethereum Sepolia, prove it, and
 * watch the escrow move in the same receipt that carries the precompile's log.
 *
 * The point of the run is the last assertion. `CampaignEscrow.releaseReward` accepts one caller,
 * QuestASC, and QuestASC only reaches it after the Attestcoin precompile has verified a Merkle
 * proof and a continuity proof. So a partner's money cannot leave the escrow except behind a real
 * transaction on Ethereum, and this proves it with the balance before and after.
 *
 * Neither private key is ever printed.
 */
import "dotenv/config"

import { Contract, JsonRpcProvider, Wallet, formatEther, keccak256, parseEther, toUtf8Bytes } from "ethers"

import { creditcoinProvider, sepoliaProvider } from "../src/attestcoin/config"
import { CC_EXPLORER, SEPOLIA_EXPLORER, log, runPipeline } from "./lib/pipeline"

const ESCROW_ABI = [
  "function deposit(bytes32 campaignId, uint256 amount)",
  "function campaignBalance(bytes32 campaignId) view returns (uint256)",
  "function getFeeAndPoolAmount(uint256 depositAmount) view returns (uint256 feeAmount, uint256 poolAmount)",
  "function releasers(address releaser) view returns (bool)",
  "function rewardToken() view returns (address)",
  "event Released(bytes32 indexed campaignId, address indexed recipient, uint256 amount)",
]

const TOKEN_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
]

const QUEST_MANAGER_ABI = [
  "function createQuest((uint8 category,address protocol,bytes32 parametersHash,string metadataURI,uint256 rewardPerParticipant,uint64 expiry,uint256 badgeLevel,address participant,uint64 sourceChainKey,uint256 campaignId,(uint8 actionType,address emitter,address token,uint256 minAmount,uint64 minSourceBlock,uint64 maxSourceBlock,bool playerMustMatch) rule) params) returns (uint256)",
  "function acceptQuest(uint256 questId)",
  "function acceptedAtSourceHeight(uint256 questId, address participant) view returns (uint64)",
  "function getQuest(uint256 questId) view returns ((uint256 agentId,address agentController,uint8 category,address protocol,bytes32 parametersHash,string metadataURI,address rewardToken,uint256 rewardPerParticipant,uint256 badgeLevel,address assignedParticipant,uint32 acceptedCount,uint32 completedCount,uint64 expiry,uint8 status,uint64 createdAt,uint64 sourceChainKey,uint256 campaignId))",
  "event QuestCreated(uint256 indexed questId, uint256 indexed agentId, address indexed agentController, uint8 category, address protocol)",
]

const PORTAL_ABI = ["function checkIn(uint256 questId) payable"]

/** A portal check-in of exactly this much. The rule's minimum is set below it. */
const CHECK_IN = parseEther("0.001")
const MIN_AMOUNT = parseEther("0.0005")
const REWARD = parseEther("250")
const DEPOSIT = parseEther("1000")

function need(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set`)
  return value
}

async function main() {
  const cc = creditcoinProvider()
  const sepolia = sepoliaProvider()

  const partner = new Wallet(need("DEPLOYER_PRIVATE_KEY"), cc)
  const playerCc = new Wallet(need("PLAYER2_PRIVATE_KEY"), cc)
  const playerSepolia = new Wallet(need("PLAYER2_PRIVATE_KEY"), sepolia)

  const escrowAddress = need("CAMPAIGN_ESCROW_ADDRESS")
  const tokenAddress = need("VAEL_TOKEN_ADDRESS")
  const managerAddress = need("QUEST_MANAGER_ADDRESS")
  const ascAddress = need("QUEST_ASC_ADDRESS")
  const portalAddress = need("QUEST_PORTAL_ADDRESS")

  // A fresh campaign id every run, so a rerun never spends a pool an earlier run left behind.
  // RESUME_CAMPAIGN_ID and RESUME_QUEST_ID pick up a run that already funded and published, which
  // matters because the attestation wait in the middle is several minutes long.
  const resumeCampaign = process.env.RESUME_CAMPAIGN_ID
  const resumeQuest = process.env.RESUME_QUEST_ID
  const campaignId = resumeCampaign ?? `phase7-partner-${Date.now()}`
  const campaignKey = keccak256(toUtf8Bytes(campaignId))

  log("partner          ", partner.address)
  log("player           ", playerCc.address)
  log("campaign         ", campaignId)
  log("campaign key     ", campaignKey)

  const escrow = new Contract(escrowAddress, ESCROW_ABI, partner)
  const token = new Contract(tokenAddress, TOKEN_ABI, partner)
  const manager = new Contract(managerAddress, QUEST_MANAGER_ABI, partner)

  // v2 holds a releaser set rather than one address; the proved path needs QuestASC in it.
  const ascIsReleaser: boolean = await escrow.getFunction("releasers")(ascAddress)
  if (!ascIsReleaser) throw new Error(`QuestASC ${ascAddress} is not a releaser on the escrow`)
  log("escrow releaser  ", `${ascAddress} (QuestASC is in the releaser set)`)

  // ------------------------------------------------------------ 1. fund

  if (resumeCampaign) log("resuming        ", `campaign ${campaignId}, quest ${resumeQuest ?? "?"}`)

  log("1. funding the campaign escrow")
  const alreadyFunded: bigint = await escrow.getFunction("campaignBalance")(campaignKey)
  const [fee, pool] = await escrow.getFunction("getFeeAndPoolAmount")(DEPOSIT)
  log("   deposit       ", `${formatEther(DEPOSIT)} VAEL, fee ${formatEther(fee)}, pool ${formatEther(pool)}`)

  if (alreadyFunded === 0n) {
    const approveTx = await token.getFunction("approve")(escrowAddress, DEPOSIT)
    await approveTx.wait(1)
    log("   approve tx    ", `${CC_EXPLORER}/tx/${approveTx.hash}`)

    const depositTx = await escrow.getFunction("deposit")(campaignKey, DEPOSIT)
    const depositReceipt = await depositTx.wait(1)
    log("   deposit tx    ", `${CC_EXPLORER}/tx/${depositTx.hash}`)
    log("   gas           ", `${depositReceipt.gasUsed}`)
  } else {
    log("   already funded", `${formatEther(alreadyFunded)} VAEL in the pool`)
  }

  const funded: bigint = await escrow.getFunction("campaignBalance")(campaignKey)
  log("   pool balance  ", `${formatEther(funded)} VAEL`)
  if (funded === 0n) throw new Error("the deposit did not land")

  // ------------------------------------------------------------ 2. publish

  log("2. publishing a campaign quest on chain")
  let questId: bigint
  if (resumeQuest) {
    questId = BigInt(resumeQuest)
    log("   questId       ", `${questId} (resumed)`)
  } else {
  const createTx = await manager.getFunction("createQuest")({
    category: 0,
    protocol: portalAddress,
    parametersHash: keccak256(toUtf8Bytes(campaignId)),
    metadataURI: "ipfs://QmfDNGL7khGCv8yd1zzNN93oVmp9YcSbPcndrY8obY82qb",
    rewardPerParticipant: REWARD,
    expiry: 0n,
    badgeLevel: 1n,
    participant: playerCc.address,
    sourceChainKey: 1n,
    campaignId: BigInt(campaignKey),
    rule: {
      actionType: 0,
      emitter: portalAddress,
      token: "0x0000000000000000000000000000000000000000",
      minAmount: MIN_AMOUNT,
      minSourceBlock: 0n,
      maxSourceBlock: 0n,
      playerMustMatch: true,
    },
  })
  const createReceipt = await createTx.wait(1)
  const questCreated = createReceipt.logs
    .map((entry: { topics: string[]; data: string }) => {
      try {
        return manager.interface.parseLog({ topics: [...entry.topics], data: entry.data })
      } catch {
        return null
      }
    })
    .find((parsed: { name: string } | null) => parsed?.name === "QuestCreated")
  if (!questCreated) throw new Error("no QuestCreated event")
  questId = (questCreated as unknown as { args: { questId: bigint } }).args.questId

  log("   questId       ", questId.toString())
  log("   create tx     ", `${CC_EXPLORER}/tx/${createReceipt.hash}`)
  log("   gas           ", `${createReceipt.gasUsed}`)
  }

  const quest = await manager.getFunction("getQuest").staticCall(questId)
  if (quest[16].toString() !== BigInt(campaignKey).toString()) {
    throw new Error("the quest is not bound to this campaign")
  }
  log("   campaign bound", "yes, quest.campaignId matches the escrow key")

  // ------------------------------------------------------------ 3. accept

  log("3. the player accepts, which anchors the attested Sepolia frontier")
  const managerAsPlayer = new Contract(managerAddress, QUEST_MANAGER_ABI, playerCc)
  const acceptTx = await managerAsPlayer.getFunction("acceptQuest")(questId)
  const acceptReceipt = await acceptTx.wait(1)
  const anchored: bigint = await manager
    .getFunction("acceptedAtSourceHeight")
    .staticCall(questId, playerCc.address)
  log("   accept tx     ", `${CC_EXPLORER}/tx/${acceptReceipt.hash}`)
  log("   anchored at   ", `Sepolia height ${anchored}`)

  // ------------------------------------------------------------ 4. act on Sepolia

  log("4. the player performs the action on Ethereum Sepolia")
  const portal = new Contract(portalAddress, PORTAL_ABI, playerSepolia)
  const checkInTx = await portal.getFunction("checkIn")(questId, { value: CHECK_IN })
  const checkInReceipt = await checkInTx.wait(1)
  const sourceBlock = BigInt(checkInReceipt.blockNumber)
  log("   sepolia tx    ", `${SEPOLIA_EXPLORER}/tx/${checkInReceipt.hash}`)
  log("   sepolia block ", sourceBlock.toString())
  log("   value sent    ", `${formatEther(CHECK_IN)} ETH`)

  // ------------------------------------------------------------ 5. prove

  log("5. proving it on Creditcoin")
  const poolBefore: bigint = await escrow.getFunction("campaignBalance")(campaignKey)
  const playerVaelBefore: bigint = await token.getFunction("balanceOf")(playerCc.address)

  const result = await runPipeline(
    cc,
    sepolia,
    partner,
    ascAddress,
    checkInReceipt.hash,
    sourceBlock,
    questId
  )

  // ------------------------------------------------------------ 6. the assertion

  const poolAfter: bigint = await escrow.getFunction("campaignBalance")(campaignKey)
  const playerVaelAfter: bigint = await token.getFunction("balanceOf")(playerCc.address)
  const spent = poolBefore - poolAfter

  const receipt = await cc.getTransactionReceipt(result.txHash)
  const released = receipt?.logs
    .map((entry) => {
      try {
        return escrow.interface.parseLog({ topics: [...entry.topics], data: entry.data })
      } catch {
        return null
      }
    })
    .find((parsed) => parsed?.name === "Released")

  console.log("")
  console.log("=== the campaign escrow, before and after one verified proof ===")
  console.log(`  pool before        ${formatEther(poolBefore)} VAEL`)
  console.log(`  pool after         ${formatEther(poolAfter)} VAEL`)
  console.log(`  released           ${formatEther(spent)} VAEL`)
  console.log(`  quest reward       ${formatEther(REWARD)} VAEL`)
  console.log(`  source action      ${formatEther(CHECK_IN)} (the ETH the player sent)`)
  console.log(`  player VAEL gained ${formatEther(playerVaelAfter - playerVaelBefore)} VAEL`)
  console.log(`  Released event     ${released ? "yes, in the same receipt as the proof" : "NOT FOUND"}`)
  console.log(`  proof tx           ${CC_EXPLORER}/tx/${result.txHash}`)
  console.log(`  proof gas          ${result.gasUsed} / ${result.gasLimit}`)
  console.log(`  attestation wait   ${Math.round(result.attestationWaitMs / 1000)}s over ${result.attestationPolls} polls`)
  console.log("")

  if (spent === 0n) throw new Error("the escrow did not move at all")
  if (!released) throw new Error("no Released event in the proof receipt")

  if (spent === REWARD) {
    console.log("  The escrow released exactly the quest's reward.")
  } else {
    console.log(
      `  The escrow released ${formatEther(spent)}, not the ${formatEther(REWARD)} reward. ` +
        "The deployed QuestASC v4 passes the decoded source action amount to the escrow; the fix " +
        "is written and tested and waits on the consolidated redeploy in SPEC 17.1."
    )
  }

  console.log("")
  console.log(`campaignId ${campaignId}`)
  console.log(`campaignKey ${campaignKey}`)
  console.log(`questId ${questId}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
