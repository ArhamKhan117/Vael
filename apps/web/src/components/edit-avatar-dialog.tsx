"use client"

import { useState, useRef } from "react"
import Image from "next/image"
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
import { Loader2, Upload, X } from "lucide-react"
import { api } from "@/lib/api"
import type { ProfileStats } from "@/hooks/useProfile"

function getDefaultAvatar(seed: string) {
  const s = seed.toLowerCase().replace(/[^a-z0-9]/g, "") || "default"
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${s}&size=128&radius=50`
}

interface EditAvatarDialogProps {
  walletAddress: string
  stats: ProfileStats | null
  onSuccess: () => void
  children: React.ReactNode
}


export function EditAvatarDialog({
  walletAddress,
  stats,
  onSuccess,
  children,
}: EditAvatarDialogProps) {
  const [open, setOpen] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState("")
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const currentAvatar = stats?.avatar_url ?? getDefaultAvatar(walletAddress)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.type.startsWith("image/")) {
        setError("Please select an image file")
        return
      }
      if (file.size > 5 * 1024 * 1024) {
        setError("Image must be less than 5MB")
        return
      }
      setAvatarFile(file)
      setAvatarUrl("")
      setError(null)
      const reader = new FileReader()
      reader.onloadend = () => setPreviewUrl(reader.result as string)
      reader.readAsDataURL(file)
    }
  }

  const handleUrlChange = (url: string) => {
    setAvatarUrl(url)
    setAvatarFile(null)
    setPreviewUrl(null)
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    let finalUrl = ""
    if (avatarFile && previewUrl) {
      finalUrl = previewUrl
    } else if (avatarUrl.trim()) {
      finalUrl = avatarUrl.trim()
    } else {
      setError("Upload an image or paste a URL")
      return
    }
    if (
      !finalUrl.startsWith("http") &&
      !finalUrl.startsWith("data:image")
    ) {
      setError("URL must start with http/https or use an uploaded image")
      return
    }

    setLoading(true)
    setError(null)
    try {
      await api.updateAvatar(walletAddress, finalUrl)
      onSuccess()
      setOpen(false)
      setAvatarFile(null)
      setPreviewUrl(null)
      setAvatarUrl("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update avatar")
    } finally {
      setLoading(false)
    }
  }

  const handleRemovePreview = () => {
    setAvatarFile(null)
    setPreviewUrl(null)
    setAvatarUrl("")
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const displayUrl = previewUrl ?? (avatarUrl || currentAvatar)
  const hasChanges = !!avatarFile || !!avatarUrl.trim()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="rounded border-[#1A1A1A] bg-black sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="text-white">Edit Picture</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Upload an image or paste an image URL
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col items-center gap-3">
            <div className="relative h-32 w-32 overflow-hidden rounded-full border-2 border-zinc-700 bg-zinc-900">
              <Image
                src={displayUrl}
                alt="Avatar"
                fill
                className="object-cover"
                unoptimized={
                  displayUrl.startsWith("data:") ||
                  displayUrl.includes("dicebear")
                }
                sizes="128px"
              />
            </div>
            {hasChanges && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemovePreview}
                className="text-zinc-400 hover:text-white"
              >
                <X className="mr-1 h-4 w-4" />
                Remove
              </Button>
            )}
          </div>
          <div>
            <Label className="text-zinc-300">Upload</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="mt-1.5 w-full rounded border-zinc-700 text-zinc-300"
            >
              <Upload className="mr-2 h-4 w-4" />
              Choose File
            </Button>
            <p className="mt-1 text-[11px] text-zinc-500">
              PNG, JPG, GIF up to 5MB
            </p>
          </div>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-zinc-700" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-black px-2 text-xs text-zinc-500">or</span>
            </div>
          </div>
          <div>
            <Label className="text-zinc-300">Image URL</Label>
            <Input
              type="url"
              placeholder="https://..."
              value={avatarUrl}
              onChange={(e) => handleUrlChange(e.target.value)}
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
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
              className="flex-1 rounded border-zinc-700 text-zinc-300"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !hasChanges}
              className="flex-1 rounded bg-white text-black hover:bg-white/90"
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
