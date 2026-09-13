import type { Metadata } from "next"

// A title with a template, so the routes below it keep the "Vael - " prefix of the root layout.
export const metadata: Metadata = { title: { default: "Academy", template: "Vael - %s" } }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
