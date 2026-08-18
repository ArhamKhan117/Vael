/**
 * Stub for the optional `@x402/*` peer dependencies of `@coinbase/cdp-sdk`.
 *
 * The Reown AppKit wagmi adapter barrel-imports every connector in `@wagmi/connectors`.
 * That pulls in the Base Account connector, which is a hard dependency of the connectors
 * package, and through it the Coinbase CDP SDK, which declares the x402 payment packages as
 * optional peers. Vael touches none of that surface, so those packages are not installed,
 * but the bundler still resolves the import graph and fails.
 *
 * CommonJS with a Proxy so any named import resolves. Each one is a function that throws
 * only if it is ever actually called, which would mean something started an x402 payment
 * flow that Vael does not have.
 */
const missing = (name) => () => {
  throw new Error(
    `@x402 is not installed. Something called "${String(name)}", which Vael does not use.`
  )
}

module.exports = new Proxy(
  {},
  {
    get(_target, property) {
      if (property === "__esModule") return true
      if (property === "default") return module.exports
      return missing(property)
    },
    has() {
      return true
    },
  }
)
