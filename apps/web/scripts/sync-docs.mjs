/**
 * Copy the two repository documents the site renders into apps/web/repo-docs/ before a build.
 *
 * `/readme` and `/whitepaper` read README.md and docs/WHITEPAPER.md at request time. In development
 * they are read straight from the repository, two levels up. A serverless bundle carries only what
 * the tracer is told to carry, and a file at the repository root cannot be named for it safely: a
 * pattern that normalises to a bare file name ("README.md") is matched by its basename anywhere
 * under the tracing root, which is every package's README in node_modules. A copy inside the app,
 * under a directory of its own, has a path the tracer can match exactly. The folder is gitignored;
 * `pnpm build` writes it and nothing else reads it.
 */
import { copyFileSync, mkdirSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const webRoot = resolve(here, "..")
const repoRoot = resolve(webRoot, "../..")
const out = join(webRoot, "repo-docs")

mkdirSync(out, { recursive: true })
for (const [from, to] of [
  ["README.md", "README.md"],
  ["docs/WHITEPAPER.md", "WHITEPAPER.md"],
]) {
  copyFileSync(join(repoRoot, from), join(out, to))
}
console.log("repo-docs: README.md and WHITEPAPER.md copied")
