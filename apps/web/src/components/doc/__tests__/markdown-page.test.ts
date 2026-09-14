import { describe, expect, it } from "vitest"

import { toSiteUrl } from "../markdown-page"

/**
 * The README and the whitepaper are written for GitHub and rendered here too. Every link in them
 * has to land somewhere real from this site: the pictures on the site itself, the two rendered
 * documents on their own pages, and every other repository file on GitHub.
 */
describe("toSiteUrl", () => {
  it("serves the README's pictures from the site", () => {
    expect(toSiteUrl("apps/web/public/readme/hero-dark.png#gh-dark-mode-only", "")).toBe(
      "/readme/hero-dark.png#gh-dark-mode-only"
    )
  })

  it("sends the two rendered documents to their own pages", () => {
    expect(toSiteUrl("./docs/WHITEPAPER.md", "")).toBe("/whitepaper")
    expect(toSiteUrl("../README.md", "docs")).toBe("/readme")
    expect(toSiteUrl("./README.md#evidence", "")).toBe("/readme#evidence")
  })

  it("sends every other repository file to GitHub, files as blobs and folders as trees", () => {
    expect(toSiteUrl("./docs/EVIDENCE.md", "")).toBe(
      "https://github.com/ArhamKhan117/Vael/blob/main/docs/EVIDENCE.md"
    )
    expect(toSiteUrl("./docs/ATTESTCOIN_INTEGRATION.md#6d-native-quests", "")).toBe(
      "https://github.com/ArhamKhan117/Vael/blob/main/docs/ATTESTCOIN_INTEGRATION.md#6d-native-quests"
    )
    expect(toSiteUrl("./contracts/src/adapters", "")).toBe(
      "https://github.com/ArhamKhan117/Vael/tree/main/contracts/src/adapters"
    )
    expect(toSiteUrl("./LICENSE", "")).toBe("https://github.com/ArhamKhan117/Vael/tree/main/LICENSE")
    expect(toSiteUrl("./ADDRESSES.md", "docs")).toBe(
      "https://github.com/ArhamKhan117/Vael/blob/main/docs/ADDRESSES.md"
    )
  })

  it("leaves anchors and absolute links alone", () => {
    expect(toSiteUrl("#the-case-for-vael", "")).toBe("#the-case-for-vael")
    expect(toSiteUrl("https://creditcoin-testnet.blockscout.com/tx/0x1", "")).toBe(
      "https://creditcoin-testnet.blockscout.com/tx/0x1"
    )
    expect(toSiteUrl("mailto:someone@example.com", "")).toBe("mailto:someone@example.com")
  })
})
