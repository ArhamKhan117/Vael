import { afterEach, describe, expect, it, vi } from "vitest"

import { ProofNotReadyError, fetchProof, toSubmitArgs } from "../proofBuilder"

/** A response in the shape the Proof Builder actually returns. */
const RAW = {
  chainKey: 1,
  headerNumber: 11668555,
  txIndex: 66,
  txHash: "0x12131f6e2e39d4a9d758db142b6f5c0b9bb356074c76ed9ec48e563d014601ac",
  txBytes: "0xdeadbeef",
  merkleProof: {
    root: "0x1111111111111111111111111111111111111111111111111111111111111111",
    siblings: [
      { hash: "0x2222222222222222222222222222222222222222222222222222222222222222", isLeft: true },
      { hash: "0x3333333333333333333333333333333333333333333333333333333333333333", isLeft: false },
    ],
  },
  continuityProof: {
    lowerEndpointDigest: "0x4444444444444444444444444444444444444444444444444444444444444444",
    roots: ["0x5555555555555555555555555555555555555555555555555555555555555555"],
  },
}

function mockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    json: async () => body,
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("fetchProof", () => {
  it("maps headerNumber and txBytes onto the names the contract call uses", async () => {
    vi.stubGlobal("fetch", mockFetch(200, RAW))
    const proof = await fetchProof(1, RAW.txHash)

    expect(proof.blockHeight).toBe(11668555)
    expect(proof.encodedTransaction).toBe("0xdeadbeef")
    expect(proof.txIndex).toBe(66)
    expect(proof.merkleProof.siblings).toHaveLength(2)
    expect(proof.merkleProof.siblings[0]?.isLeft).toBe(true)
    expect(proof.continuityProof.roots).toHaveLength(1)
  })

  it("unwraps a response nested under data", async () => {
    vi.stubGlobal("fetch", mockFetch(200, { data: RAW }))
    const proof = await fetchProof(1, RAW.txHash)
    expect(proof.blockHeight).toBe(11668555)
  })

  /** 422 is what the prover returns before the block is bracketed by attestations. */
  it("treats 422 as not-ready rather than a failure", async () => {
    vi.stubGlobal("fetch", mockFetch(422, {}))
    await expect(fetchProof(1, RAW.txHash)).rejects.toBeInstanceOf(ProofNotReadyError)
  })

  it("treats 404 as not-ready too", async () => {
    vi.stubGlobal("fetch", mockFetch(404, {}))
    await expect(fetchProof(1, RAW.txHash)).rejects.toBeInstanceOf(ProofNotReadyError)
  })

  it("surfaces a real server failure as a plain error", async () => {
    vi.stubGlobal("fetch", mockFetch(500, {}))
    await expect(fetchProof(1, RAW.txHash)).rejects.toThrow(/500/)
  })
})

describe("toSubmitArgs", () => {
  it("converts heights to bigint and preserves sibling laterality", async () => {
    vi.stubGlobal("fetch", mockFetch(200, RAW))
    const proof = await fetchProof(1, RAW.txHash)
    const args = toSubmitArgs(proof)

    expect(args.chainKey).toBe(1n)
    expect(args.blockHeight).toBe(11668555n)
    // Laterality is what makes calculateTxIndex able to recover the index, so it must survive.
    expect(args.merkleProof.siblings.map((s) => s.isLeft)).toEqual([true, false])
    expect(args.continuityProof.roots).toEqual(RAW.continuityProof.roots)
  })
})
