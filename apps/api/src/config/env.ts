import { config } from "dotenv"
import { z } from "zod"

config()

/**
 * `.env` files carry unset variables as empty strings, not as absent keys, so an optional field
 * has to treat "" as absent. Without this, every placeholder line in .env.example fails validation
 * the moment it is copied.
 */
const emptyAsUndefined = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => (value === "" ? undefined : value), schema.optional())

const address = z.string().regex(/^0x[a-fA-F0-9]{40}$/)
const optionalAddress = emptyAsUndefined(address)

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

})

export const env = envSchema.parse(process.env)

/**
 * Credentials for the third-party services.
 *
 * Deliberately separate and validated lazily. The Attestcoin worker talks to Creditcoin and
 * Sepolia and needs none of these, so requiring them up front would mean an operator could not run
 * the proof path without a Groq key. Anything that actually uses one of these imports
 * `serviceEnv()`, which throws with a clear message on first use if the credential is missing, so
 * the API still fails loudly rather than silently degrading.
 */
const serviceEnvSchema = z.object({
  GROQ_API_KEY: z.string().min(10),
  PINATA_JWT: z.string().min(10),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(10),
})

export type ServiceEnv = z.infer<typeof serviceEnvSchema>

let cachedServiceEnv: ServiceEnv | undefined

export function serviceEnv(): ServiceEnv {
  if (!cachedServiceEnv) {
    const parsed = serviceEnvSchema.safeParse(process.env)
    if (!parsed.success) {
      const missing = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ")
      throw new Error(
        `Missing or invalid service credentials: ${missing}. ` +
          "These are required for AI quest generation, IPFS pinning, and the Supabase cache. " +
          "The Attestcoin worker does not need them."
      )
    }
    cachedServiceEnv = parsed.data
  }
  return cachedServiceEnv
}
