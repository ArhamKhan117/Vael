import { join } from "node:path";
import type { NextConfig } from "next";

/** See src/lib/stubs/empty.ts for why these are aliased away. */
const X402_STUBS = [
  "@x402/core",
  "@x402/core/client",
  "@x402/evm",
  "@x402/evm/exact/client",
  "@x402/evm/upto/client",
  "@x402/extensions",
  "@x402/svm",
  "@x402/svm/exact/client",
];

const nextConfig: NextConfig = {
  // /readme and /whitepaper read README.md and docs/WHITEPAPER.md from the repository at request
  // time, so the page can never drift from the document a reader would find. Both files live two
  // levels above this app, which a serverless bundle traced from apps/web alone would not carry.
  // The tracing root is the monorepo root and the two files are included by name; the standalone
  // output and a Vercel deployment then hold them at README.md and docs/WHITEPAPER.md under the
  // traced root, which is where the markdown page looks.
  // A standalone build is not what Vercel wants, so it is opt-in: NEXT_STANDALONE=1 pnpm build
  // produces .next/standalone, which is how the tracing above is checked without deploying.
  output: process.env.NEXT_STANDALONE ? "standalone" : undefined,
  outputFileTracingRoot: join(__dirname, "../../"),
  // The two documents the site renders are copied into repo-docs/ by scripts/sync-docs.mjs before
  // every build, because a pattern that normalises to a bare file name ("README.md", at the
  // repository root) is matched by its basename anywhere under the tracing root: every package's
  // README in node_modules and the contracts' vendored libraries came along, five thousand files
  // per function. A path with a directory in it is matched exactly.
  outputFileTracingIncludes: {
    "/readme": ["repo-docs/README.md"],
    "/whitepaper": ["repo-docs/WHITEPAPER.md"],
  },
  turbopack: {
    resolveAlias: Object.fromEntries(
      X402_STUBS.map((specifier) => [specifier, "./src/lib/stubs/x402.cjs"])
    ),
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ipfs.io",
        port: "",
        pathname: "/ipfs/**",
      },
      {
        protocol: "https",
        hostname: "gateway.pinata.cloud",
        port: "",
        pathname: "/ipfs/**",
      },
      {
        protocol: "https",
        hostname: "cloudflare-ipfs.com",
        port: "",
        pathname: "/ipfs/**",
      },
      {
        protocol: "https",
        hostname: "picsum.photos",
        port: '',
        pathname: '/seed/**',
      },
      {
        protocol: 'https',
        hostname: 'github.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'api.dicebear.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.brandfetch.io',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
