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
  title: {
    default: "Vael - Prove It On-Chain",
    template: "%s | Vael",
  },
  description: TAGLINE,
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
