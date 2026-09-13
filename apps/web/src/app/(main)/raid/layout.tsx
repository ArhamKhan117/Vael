import type { Metadata } from "next"

export const metadata: Metadata = { title: "Raid" }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
