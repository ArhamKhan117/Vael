import type { Metadata } from "next"

import { MarkdownPage } from "@/components/doc/markdown-page"

export const metadata: Metadata = {
  title: "Whitepaper",
  description: "The argument behind Vael: what is being claimed, and what makes the claim checkable.",
}

export default function WhitepaperPage() {
  return (
    <MarkdownPage
      file="docs/WHITEPAPER.md"
      title="Whitepaper"
      intro="The argument behind Vael: what is claimed, what enforces it, and what a reader can check for themselves."
      repoPath="docs/WHITEPAPER.md"
    />
  )
}
