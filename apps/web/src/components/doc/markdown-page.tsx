import { readFile } from "node:fs/promises"
import { join } from "node:path"
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
    source = await readFile(join(process.cwd(), "..", "..", file), "utf8")
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
          <Markdown remarkPlugins={[remarkGfm]}>{source}</Markdown>
        </article>
      </div>
    </main>
  )
}
