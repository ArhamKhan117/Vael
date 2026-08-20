import { Contract, JsonRpcProvider } from "ethers"

import { Result, err, ok } from "./config"

/**
 * ChainInfo precompile client.
 *
 * The method names are `snake_case` because on a precompile the name *is* the selector. A
 * camelCase spelling produces a different 4-byte selector and the call reverts. Only the methods
 * the worker actually calls are declared.
 */
export const CHAIN_INFO_PRECOMPILE = "0x0000000000000000000000000000000000000fD3"

export const CHAIN_INFO_ABI = [
  "function get_latest_attestation_height_and_hash(uint64 chainKey) view returns (tuple(uint64 height, bytes32 hash, bool isAttestation, bool exists))",
  "function is_height_attested(uint64 chainKey, uint64 targetHeight) view returns (bool)",
  "function get_attestation_genesis_height(uint64 chainKey) view returns (uint64)",
] as const

export interface AttestationFrontier {
  height: bigint
  digest: string
  isAttestation: boolean
  exists: boolean
  /** Creditcoin block the read was pinned to. */
  readAtBlock: number
}

export function chainInfoContract(provider: JsonRpcProvider): Contract {
  return new Contract(CHAIN_INFO_PRECOMPILE, CHAIN_INFO_ABI, provider)
}

/**
 * Read the attested frontier for a source chain.
 *
 * Pinned to one block tag on purpose. Creditcoin's `finalized` lags `latest`, and an unpinned
 * sequence of reads can straddle a block and produce a frontier that never existed at any single
 * height. The block number is returned so a caller can report what it saw.
 */
export async function getAttestedFrontier(
  provider: JsonRpcProvider,
  chainKey: number,
  blockTag?: number
): Promise<Result<AttestationFrontier>> {
  try {
    const readAtBlock = blockTag ?? (await provider.getBlockNumber())
    const contract = chainInfoContract(provider)
    const result = await contract
      .getFunction("get_latest_attestation_height_and_hash")
      .staticCall(chainKey, { blockTag: readAtBlock })
    return ok({
      height: BigInt(result.height),
      digest: result.hash,
      isAttestation: Boolean(result.isAttestation),
      exists: Boolean(result.exists),
      readAtBlock,
    })
  } catch (error: any) {
    return err(`ChainInfo read failed: ${error?.shortMessage ?? error?.message ?? String(error)}`)
  }
}
