import { readFile } from "node:fs/promises"
import { join } from "node:path"

/**
 * Where the repository's documents are, from wherever this is running.
 *
 * In development and in the standalone build the app runs from apps/web, two levels below the
 * repository (or below the traced root, which mirrors it). On Vercel the function runs from the
 * traced root itself. Both are tried, in that order, so one file can serve both without a copy.
 */
/**
 * The file name, hidden from static analysis on purpose.
 *
 * The tracer that decides what a serverless bundle carries follows string arithmetic into
 * readFile. Given `join(process.cwd(), "..", "..", file)` it emitted the whole directory (the
 * first standalone build weighed 429 MB and held the entire repository); given a path whose last
 * segment it could still read it emitted `**\/README.md`, which is every package's README under
 * node_modules and the contracts' vendored libraries. Reversed twice at run time the name is the
 * same name, and the tracer sees nothing it can follow. The two documents are then named for it
 * explicitly in next.config.ts, which is the one place that decides what the bundle holds.
 */
function opaque(value: string): string {
  return [...value].reverse().reverse().join("")
}

async function readRepositoryFile(file: string): Promise<string> {
  const roots = [["..", ".."], []]
  let lastError: unknown
  for (const up of roots) {
    const candidate = [...up, ...opaque(file).split("/")].reduce((acc, part) => join(acc, part), process.cwd())
    try {
      return await readFile(candidate, "utf8")
    } catch (error) {
      lastError = error
    }
  }
  throw lastError
}
import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"

/**
 * Render one of the repository's own markdown documents as a page.
 *
 * The file is read from disk at request time rather than copied into the app, so the page cannot
 * drift from the document a reader would find in the repository. That matters more here than
 * anywhere else on the site: these two documents are the ones making the claims.
 *
 * `remark-gfm` is needed for the tables. Both documents are full of them and without it they render
 * as pipe-separated lines.
 */
/**
 * The README's pictures are committed under apps/web/public/readme so GitHub can render them from
 * the repository, and referenced there by that repository path. Here the same path has to be the
 * site's own URL.
 */
function toSiteUrl(url: string): string {
  return url.startsWith("apps/web/public/") ? `/${url.slice("apps/web/public/".length)}` : url
}

/**
 * GitHub shows one of a light/dark pair by the `#gh-dark-mode-only` / `#gh-light-mode-only`
 * fragment on the image URL. This site is dark, so the light-only image is left out and the
 * fragment is dropped from the other.
 */
function DocImage(props: React.ComponentProps<"img">) {
  const src = typeof props.src === "string" ? props.src : ""
  if (src.endsWith("#gh-light-mode-only")) return null
  // eslint-disable-next-line @next/next/no-img-element
  return <img {...props} src={src.replace(/#gh-dark-mode-only$/, "")} alt={props.alt ?? ""} />
}

/** GitHub's heading ids, so the README's own table of contents jumps on this page too. */
function slug(children: React.ReactNode): string {
  const text = (Array.isArray(children) ? children : [children])
    .map((child) => (typeof child === "string" || typeof child === "number" ? String(child) : ""))
    .join("")
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
}

function Heading(level: 1 | 2 | 3 | 4) {
  const Tag = `h${level}` as const
  return function DocHeading(props: React.ComponentProps<typeof Tag>) {
    return <Tag id={slug(props.children)} {...props} />
  }
}

const HEADINGS = { h1: Heading(1), h2: Heading(2), h3: Heading(3), h4: Heading(4) }

export async function MarkdownPage({
  file,
  title,
  intro,
  repoPath,
}: {
  file: string
  title: string
  intro: string
  repoPath: string
}) {
  let source: string
  try {
    source = await readRepositoryFile(file)
  } catch {
    source = `# ${title}\n\nThis document could not be read from the repository.`
  }

  return (
    <main className="bg-black px-5 pb-20 pt-24 text-white md:px-10">
      <div className="mx-auto w-full max-w-3xl">
        <header className="border-b border-[#1A1A1A] pb-6">
          <h1 className="text-2xl font-semibold text-white">{title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">{intro}</p>
          <p className="mt-2 font-mono text-[11px] text-zinc-600">{repoPath}</p>
        </header>

        <article className="doc-prose pt-8">
          <Markdown remarkPlugins={[remarkGfm]} urlTransform={toSiteUrl} components={{ img: DocImage, ...HEADINGS }}>
            {source}
          </Markdown>
        </article>
      </div>
    </main>
  )
}
