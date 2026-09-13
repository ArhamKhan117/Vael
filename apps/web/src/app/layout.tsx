import type { Metadata } from "next";
import { Space_Mono, Matemasie } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Providers } from "@/lib/providers";

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const matemasie = Matemasie({
  variable: "--font-matemasie",
  subsets: ["latin"],
  weight: ["400"],
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
const TAGLINE =
  "Do real DeFi on Ethereum. Prove it on Creditcoin with Attestcoin. Earn rewards no backend can fake.";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  // The tab reads "Vael" on the landing page and "Vael - Quests" and so on everywhere else; each
  // route names itself in its own layout.
  title: {
    default: "Vael",
    template: "Vael - %s",
  },
  description: TAGLINE,
  // The icon set is generated from the logo by tools/make_brand.py: the wordmark on a black
  // rounded tile with a one-pixel lighter border, so it reads on a light tab bar as well as a
  // dark one. favicon.ico bundles 16, 32 and 48 for browsers that ask for the classic file.
  icons: {
    icon: [
      { url: "/icons/favicon.ico", sizes: "16x16 32x32 48x48" },
      { url: "/icons/icon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/icons/favicon.ico"],
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "Vael - Prove It On-Chain",
    description: TAGLINE,
    url: APP_URL,
    siteName: "Vael",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Vael - Prove It On-Chain",
    description: TAGLINE,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scrollbar-hide">
      <body
        className={`${spaceMono.variable} ${matemasie.variable} font-mono antialiased bg-black`}
      >
        <Providers>
          <TooltipProvider>{children}</TooltipProvider>
        </Providers>
      </body>
    </html>
  );
}
