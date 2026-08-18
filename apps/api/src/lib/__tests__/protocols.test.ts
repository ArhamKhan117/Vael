import {
  PROTOCOLS,
  SEPOLIA_CHAIN_ID,
  SEPOLIA_TOKENS,
  getAllProtocols,
  getProtocolByAddress,
  getProtocolByKey,
  getProtocolsByCategory,
  getProtocolsByChain,
} from "../protocols"

describe("Protocols", () => {
  describe("getProtocolByAddress", () => {
    it("returns Uniswap v3 by its router address", () => {
      const protocol = getProtocolByAddress("0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E")
      expect(protocol?.name).toBe("Uniswap v3")
      expect(protocol?.category).toBe("swap")
    })

    it("returns Aave v3 by its Pool address", () => {
      const protocol = getProtocolByAddress("0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951")
      expect(protocol?.name).toBe("Aave v3")
      expect(protocol?.category).toBe("lend")
    })

    it("matches an emitter address that is not the primary address", () => {
      const protocol = getProtocolByAddress(SEPOLIA_TOKENS.WETH9)
      expect(protocol?.key).toBe("ERC20_TRANSFER")
    })

    it("is case-insensitive", () => {
      const protocol = getProtocolByAddress("0x6AE43D3271FF6888E7FC43FD7321A503FF738951")
      expect(protocol?.name).toBe("Aave v3")
    })

    it("returns null for an unknown address", () => {
      expect(getProtocolByAddress("0xdeadbeef")).toBeNull()
    })
  })

  describe("getProtocolByKey", () => {
    it("resolves a registered key", () => {
      expect(getProtocolByKey("UNISWAP_V3")?.name).toBe("Uniswap v3")
    })

    it("returns null for an unknown key", () => {
      expect(getProtocolByKey("NOT_A_PROTOCOL")).toBeNull()
    })
  })

  describe("getAllProtocols", () => {
    it("returns every registered protocol", () => {
      expect(getAllProtocols()).toHaveLength(Object.keys(PROTOCOLS).length)
    })

    it("gives every protocol the required fields", () => {
      for (const protocol of getAllProtocols()) {
        expect(protocol.key).toBeTruthy()
        expect(protocol.name).toBeTruthy()
        expect(protocol.chainId).toBeGreaterThan(0)
        expect(protocol.evmAddress).toMatch(/^0x[0-9a-fA-F]{40}$/)
        expect(protocol.website).toBeTruthy()
        expect(protocol.description).toBeTruthy()
        expect(Array.isArray(protocol.emitterAddresses)).toBe(true)
      }
    })

    it("gives every Sepolia protocol the Attestcoin source chain key", () => {
      for (const protocol of getProtocolsByChain("sepolia")) {
        expect(protocol.chainId).toBe(SEPOLIA_CHAIN_ID)
        expect(protocol.attestcoinChainKey).toBe(1)
      }
    })
  })

  describe("getProtocolsByCategory", () => {
    it("returns only swap protocols", () => {
      const swaps = getProtocolsByCategory("swap")
      expect(swaps.length).toBeGreaterThan(0)
      expect(swaps.every((protocol) => protocol.category === "swap")).toBe(true)
    })

    it("returns only lend protocols", () => {
      const lends = getProtocolsByCategory("lend")
      expect(lends.length).toBeGreaterThan(0)
      expect(lends.every((protocol) => protocol.category === "lend")).toBe(true)
    })
  })
})
