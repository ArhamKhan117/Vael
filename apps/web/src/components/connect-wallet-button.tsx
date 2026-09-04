"use client"

import React from "react"
import { useAccount, useBalance, useDisconnect } from "wagmi"
import { useAppKit } from "@reown/appkit/react"
import type { Address } from "viem"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LogOut, MoveRight } from "lucide-react"
import Link from "next/link"
import { CREDITCOIN_CHAIN_ID, SEPOLIA_CHAIN_ID } from "@/lib/chains"

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

const CHAIN_NAMES: Record<number, string> = {
  [CREDITCOIN_CHAIN_ID]: "Creditcoin Testnet",
  [SEPOLIA_CHAIN_ID]: "Ethereum Sepolia",
}

/** Sepolia is a valid place to be: it is where players perform the source action. */
const SUPPORTED_CHAIN_IDS: number[] = [CREDITCOIN_CHAIN_ID, SEPOLIA_CHAIN_ID]

/**
 * `fullWidth` is for the places that stack it in a column, such as a dashboard drawer. In the
 * header it sizes to its content, because the header lays itself out around it.
 */
export default function ConnectWalletButton({ fullWidth = false }: { fullWidth?: boolean } = {}) {
  const { address, isConnected, chainId } = useAccount()
  const { disconnect } = useDisconnect()
  const { open } = useAppKit()

  const vaelTokenAddress =
    process.env.NEXT_PUBLIC_VAEL_TOKEN_ADDRESS &&
    /^0x[a-fA-F0-9]{40}$/.test(process.env.NEXT_PUBLIC_VAEL_TOKEN_ADDRESS)
      ? (process.env.NEXT_PUBLIC_VAEL_TOKEN_ADDRESS as Address)
      : undefined

  const { data: balance, isLoading: isBalanceLoading } = useBalance({
    address,
    token: vaelTokenAddress,
    query: { enabled: !!address },
  })

  const [copied, setCopied] = React.useState(false)

  const handleCopyAddress = React.useCallback(async (addr?: string) => {
    if (!addr) return
    try {
      await navigator.clipboard.writeText(addr)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch {
      /* ignore */
    }
  }, [])

  const openConnectModal = () => open({ view: "Connect" })
  const openNetworksModal = () => open({ view: "Networks" })

  const chainName = CHAIN_NAMES[chainId ?? 0] ?? `Chain ${chainId ?? 0}`
  const isWrongNetwork =
    isConnected && chainId != null && !SUPPORTED_CHAIN_IDS.includes(chainId)

  const width = fullWidth ? "w-full" : "w-auto"

  return (
    <div className={width}>
      {!isConnected ? (
        <Button
          variant="default"
          onClick={openConnectModal}
          className={`h-9 rounded bg-white font-semibold text-black hover:bg-white/80 ${width}`}
        >
          {/* At phone width the word "Wallet" is what gets cut, and "Connect" alone is clear. */}
          <span className="sm:hidden">Connect</span>
          <span className="hidden sm:inline">Connect Wallet</span>
        </Button>
      ) : isWrongNetwork ? (
        <Button
          variant="default"
          onClick={openNetworksModal}
          className={`h-9 rounded bg-white font-semibold text-black hover:bg-white/80 ${width}`}
        >
          Wrong network
        </Button>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="default"
              className={`h-9 rounded bg-white font-semibold text-black hover:bg-white/80 ${width}`}
            >
              {shortAddress(address ?? "")}
              {/* The balance is the first thing to go when the header runs out of room. The
                  address stays, because it is how a player knows which wallet they are in. */}
              {balance ? (
                <span className="hidden sm:inline">
                  {` (${Number(balance.formatted).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${balance.symbol})`}
                </span>
              ) : null}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded">
            <DropdownMenuLabel className="flex items-center gap-2">
              <span className="font-medium">Wallet</span>
              <DropdownMenuShortcut className="tracking-normal">
                {chainName}
              </DropdownMenuShortcut>
            </DropdownMenuLabel>

            <DropdownMenuGroup>
              <Link href="/profile">
                <DropdownMenuItem className="flex items-center justify-between cursor-pointer">
                  Profile
                  <MoveRight className="w-4 h-4" />
                </DropdownMenuItem>
              </Link>

              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault()
                  handleCopyAddress(address ?? undefined)
                }}
                className="cursor-pointer"
              >
                {address ? shortAddress(address) : ""}
                <DropdownMenuShortcut className="tracking-normal">
                  {copied ? "Copied" : "Copy"}
                </DropdownMenuShortcut>
              </DropdownMenuItem>

              <DropdownMenuItem disabled>
                {vaelTokenAddress ? "VAEL Balance" : "Balance"}
                <DropdownMenuShortcut className="tracking-normal">
                  {isBalanceLoading
                    ? "…"
                    : balance
                      ? `${Number(balance.formatted).toLocaleString(undefined, { maximumFractionDigits: 4 })} ${balance.symbol}`
                      : "-"}
                </DropdownMenuShortcut>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="flex items-center justify-between cursor-pointer"
              variant="destructive"
              onSelect={(e) => {
                e.preventDefault()
                disconnect()
              }}
            >
              Disconnect
              <LogOut className="w-4 h-4" />
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
