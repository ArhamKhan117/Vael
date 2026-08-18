"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Edit2 } from "lucide-react"
import { api } from "@/lib/api"
import type { ProfileStats } from "@/hooks/useProfile"

interface EditProfileDialogProps {
  walletAddress: string
  stats: ProfileStats | null
  onSuccess: () => void
  children?: React.ReactNode
}

export function EditProfileDialog({
  walletAddress,
  stats,
  onSuccess,
  children,
}: EditProfileDialogProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open && stats) {
      setName(stats.name ?? "")
      setEmail(stats.email ?? "")
      setError(null)
    }
  }, [open, stats])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError("Name is required")
      return
    }
    if (!email.trim()) {
      setError("Email is required")
      return
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.trim())) {
      setError("Invalid email format")
      return
    }

    setLoading(true)
    setError(null)
    try {
      await api.saveProfile(walletAddress, {
        name: name.trim(),
        email: email.trim().toLowerCase(),
      })
      onSuccess()
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children ?? (
          <Button variant="outline" size="sm" className="rounded">
            <Edit2 className="mr-2 h-4 w-4" />
            Edit Profile
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="rounded border-[#1A1A1A] bg-black sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="text-white">Edit Profile</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Update your display name and email
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="profile-name" className="text-zinc-300">
              Name
            </Label>
            <Input
              id="profile-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              disabled={loading}
              className="mt-1.5 border-zinc-700 bg-zinc-900 text-white placeholder:text-zinc-500"
            />
          </div>
          <div>
            <Label htmlFor="profile-email" className="text-zinc-300">
              Email
            </Label>
            <Input
              id="profile-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              disabled={loading}
              className="mt-1.5 border-zinc-700 bg-zinc-900 text-white placeholder:text-zinc-500"
            />
          </div>
          {error && (
            <p className="rounded bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
              {error}
            </p>
          )}
          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="default"
              onClick={() => setOpen(false)}
              disabled={loading}
              className="flex-1 rounded font-semibold bg-white text-black hover:bg-white/80"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="default"
              disabled={loading}
              className="flex-1 rounded font-semibold bg-white text-black hover:bg-white/80"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
