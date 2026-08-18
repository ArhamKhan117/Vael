import { config } from "dotenv"
import { z } from "zod"

config()

const address = z.string().regex(/^0x[a-fA-F0-9]{40}$/)
const optionalAddress = address.optional()

/** Comma-separated URL list, tried in order after the primary. */
const urlList = z
  .string()
  .default("")
  .transform((value) =>
    value
      .split(",")
      .map((url) => url.trim())
      .filter((url) => url.length > 0)
  )

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),

  // Chains
  CREDITCOIN_RPC_URL: z.string().url().default("https://rpc.cc3-testnet.creditcoin.network"),
  CREDITCOIN_RPC_FALLBACK_URLS: urlList,
  SEPOLIA_RPC_URL: z.string().url(),
  SEPOLIA_RPC_FALLBACK_URLS: urlList,
  RPC_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  RPC_BATCH_MAX_COUNT: z.coerce.number().int().positive().default(1),

  // Worker tuning. Public endpoints cap eth_getLogs ranges and the Creditcoin RPC
  // times out getLogs at 10 s, so every scan is chunked and the window adapts.
  WORKER_LOG_CHUNK_MAX: z.coerce.number().int().positive().default(2000),
  WORKER_LOG_CHUNK_MIN: z.coerce.number().int().positive().default(1),
  WORKER_ENDPOINT_FAILURE_THRESHOLD: z.coerce.number().int().positive().default(3),
  WORKER_BATCH_MAX_PROOFS: z.coerce.number().int().positive().default(10),
  WORKER_BATCH_MAX_SPAN: z.coerce.number().int().positive().default(1000),
  ATTESTATION_WAIT_TIMEOUT_MS: z.coerce.number().int().positive().default(1_200_000),

  // Attestcoin
  SOURCE_CHAIN_KEY: z.coerce.number().int().nonnegative().default(1),
  PROOF_BUILDER_URL: z.string().url().default("https://prover.cc3-testnet.creditcoin.network"),

  // Keys (testnet only)
  AGENT_CONTROLLER_PRIVATE_KEY: z.string().min(10),
  WORKER_PRIVATE_KEY: z.string().min(10),
  DEPLOYER_ADDRESS: optionalAddress,

  // Creditcoin testnet contracts
  QUEST_MANAGER_ADDRESS: address,
  REWARD_VAULT_ADDRESS: address,
  BADGE_NFT_ADDRESS: address,
  CAMPAIGN_ESCROW_ADDRESS: optionalAddress,
  QUEST_ASC_ADDRESS: optionalAddress,
  VAEL_HERO_ADDRESS: optionalAddress,
  RAID_BOSS_ADDRESS: optionalAddress,
  REPUTATION_REGISTRY_ADDRESS: address,
  VALIDATION_REGISTRY_ADDRESS: address,
  AGENT_REGISTRY_ADAPTER_ADDRESS: address,

  // Sepolia contracts
  QUEST_PORTAL_ADDRESS: optionalAddress,

  // External services
  GROQ_API_KEY: z.string().min(10),
  PINATA_JWT: z.string().min(10),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(10),
})

export const env = envSchema.parse(process.env)
