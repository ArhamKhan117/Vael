import type { Metadata } from "next"

import { MarkdownPage } from "@/components/doc/markdown-page"

export const metadata: Metadata = {
  title: "README",
  description: "What Vael is, how it is put together, and how to run it.",
}

export default function ReadmePage() {
  return (
    <MarkdownPage
      file="README.md"
      title="README"
      intro="What Vael is, how it is put together, and how to run it. This is the repository's own README, read from disk, not a copy."
      repoPath="README.md"
    />
  )
}
