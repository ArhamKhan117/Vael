"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Calendar as CalendarIcon, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAccount } from "wagmi";
import { api, type Campaign } from "@/lib/api";
import { useCampaignBalance, useDepositAmountForPool } from "@/hooks/useCampaignEscrow";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import RichTextEditor from "@/components/rich-text-editor";
import Image from "next/image";
import { useParams } from "next/navigation";
import { DepositActivateDialog } from "@/components/deposit-activate-dialog";

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const questSchema = z.object({
  partnerName: z.string().optional(),
  title: z.string().min(1),
  description: z.string().min(1),
  periodStart: z.string(),
  periodEnd: z.string(),
  thumbnail: z.any().optional(),
  network: z.string(),
  token: z.string(),
  token_amount_per_winner: z.string(),
  winners: z.string(),
})
type QuestFormValues = z.infer<typeof questSchema>;

const STEP_LABELS = ["Quest Info", "Rewards Info", "Quest Activate"] as const;

export default function EditQuestPage() {
  const params = useParams<{ id: string }>();
  const { address, isConnected } = useAccount();
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialThumbnailUrl, setInitialThumbnailUrl] = useState<string | null>(null);
  const [depositDialogOpen, setDepositDialogOpen] = useState(false);
  const [saveDraftStatus, setSaveDraftStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [publishLoading, setPublishLoading] = useState(false);

  const { balanceFormatted } = useCampaignBalance(campaign?.id ?? null);

  const form = useForm<QuestFormValues>({
    resolver: zodResolver(questSchema),
    defaultValues: {
      partnerName: "",
      title: "",
      description: "<p></p>",
      periodStart: "",
      periodEnd: "",
      network: "creditcoin",
      token: "usdc",
      token_amount_per_winner: "",
      winners: "",
      thumbnail: undefined,
    },
  });

  const { control, handleSubmit, watch, setValue, reset } = form;
  const thumbnailFiles = watch("thumbnail");
  const tokenPerWinner = watch("token_amount_per_winner");
  const winners = watch("winners");
  const formPoolAmount = (Number(tokenPerWinner) || 0) * (Number(winners) || 0);

  useEffect(() => {
    const id = params?.id;
    if (!id) return;

    api.getCampaign(id)
      .then((c) => {
        setCampaign(c);
        setInitialThumbnailUrl(c.thumbnail ?? null);
        const poolAmount = Number(c.pool_amount) || 0;
        const maxParticipants = c.max_participants || 1;
        const rewardPerQuest = poolAmount / maxParticipants;

        reset({
          partnerName: c.partner_name ?? "",
          title: c.title,
          description: c.description ?? "<p></p>",
          periodStart: c.start_at ?? "",
          periodEnd: c.end_at ?? "",
          network: "creditcoin",
          token: (c.pool_token ?? "usdc").toLowerCase(),
          token_amount_per_winner: String(rewardPerQuest),
          winners: String(maxParticipants),
        });
        setValue("thumbnail", [{}], { shouldValidate: false });
      })
      .catch(() => setCampaign(null))
      .finally(() => setLoading(false));
  }, [params?.id, reset, setValue]);


  const previewUrl = useMemo(() => {
    if (
      thumbnailFiles &&
      thumbnailFiles.length > 0 &&
      thumbnailFiles[0] instanceof File
    ) {
      return URL.createObjectURL(thumbnailFiles[0]);
    }
    return null;
  }, [thumbnailFiles]);

  const displayThumbnail = previewUrl ?? initialThumbnailUrl;

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleClearThumbnail = () => {
    setValue("thumbnail", undefined);
    setInitialThumbnailUrl(null);
    const input = document.getElementById(
      "quest-thumbnail-input"
    ) as HTMLInputElement | null;
    if (input) {
      input.value = "";
    }
  };

  const campaignPoolAmount = campaign ? Number(campaign.pool_amount) || 0 : 0;
  const poolAmount = Math.max(campaignPoolAmount, formPoolAmount);
  const { depositAmount, feeAmount } = useDepositAmountForPool(poolAmount);
  const needsDeposit = campaign?.status === "pending" && poolAmount > 0;
  const hasEnoughBalance = poolAmount > 0 && balanceFormatted != null && balanceFormatted >= poolAmount;
  const canDeposit = poolAmount > 0;

  const handleDepositSuccess = () => {
    setDepositDialogOpen(false);
    setCampaign((prev) => (prev ? { ...prev, status: "active" as const } : null));
  };

  const handlePublish = async (): Promise<boolean> => {
    if (!campaign) return false;
    const values = form.getValues();
    const tokenPerWinner = Number(values.token_amount_per_winner) || 0;
    const maxParticipants = Number(values.winners) || 0;
    const poolAmt = tokenPerWinner * maxParticipants;
    if (poolAmt <= 0) return false;
    setPublishLoading(true);
    try {
      const files = values.thumbnail;
      const file = files && (Array.isArray(files) ? files[0] : (files as FileList)?.[0]);
      let thumbnail: string | null | undefined = undefined;
      if (file instanceof File) {
        thumbnail = await fileToBase64(file);
      }
      await api.updateCampaign(campaign.id, {
        title: values.title,
        description: values.description,
        partner_name: values.partnerName?.trim() || null,
        start_at: values.periodStart || undefined,
        end_at: values.periodEnd || undefined,
        pool_amount: poolAmt,
        max_participants: maxParticipants,
        pool_token: values.token,
        ...(thumbnail != null && { thumbnail }),
      });
      await api.updateCampaignStatus(campaign.id, "pending");
      const updated = await api.getCampaign(campaign.id);
      setCampaign(updated);
      return true;
    } catch {
      setSaveDraftStatus("error");
      setTimeout(() => setSaveDraftStatus("idle"), 3000);
      return false;
    } finally {
      setPublishLoading(false);
    }
  };

  const onSubmit = () => {};

  const onSaveDraft = async (values: QuestFormValues) => {
    if (!campaign) return;
    setSaveDraftStatus("saving");
    try {
      const tokenPerWinner = Number(values.token_amount_per_winner) || 0;
      const maxParticipants = Number(values.winners) || 0;
      const poolAmt = tokenPerWinner * maxParticipants;
      const files = values.thumbnail;
      const file = files && (Array.isArray(files) ? files[0] : (files as FileList)?.[0]);
      let thumbnail: string | null | undefined = undefined;
      if (file instanceof File) {
        thumbnail = await fileToBase64(file);
      }
      await api.updateCampaign(campaign.id, {
        title: values.title,
        description: values.description,
        partner_name: values.partnerName?.trim() || null,
        start_at: values.periodStart || undefined,
        end_at: values.periodEnd || undefined,
        pool_amount: poolAmt,
        max_participants: maxParticipants,
        pool_token: values.token,
        ...(thumbnail != null && { thumbnail }),
      });
      setCampaign((prev) => (prev ? { ...prev, title: values.title, description: values.description ?? null, partner_name: values.partnerName?.trim() || null, pool_amount: poolAmt, max_participants: maxParticipants } : null));
      setSaveDraftStatus("saved");
      setTimeout(() => setSaveDraftStatus("idle"), 3000);
    } catch {
      setSaveDraftStatus("error");
      setTimeout(() => setSaveDraftStatus("idle"), 3000);
    }
  };

  const goNext = () => {
    if (step === 0) setStep(1);
    else if (step === 1) setStep(2);
  };

  const goPrevious = () => {
    if (step === 1) setStep(0);
    else if (step === 2) setStep(1);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d0e13] px-5 pb-20 pt-24 text-white md:px-10">
        <div className="mx-auto flex max-w-7xl items-center justify-center py-20">
          <p className="text-zinc-400">Loading campaign...</p>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-[#0d0e13] px-5 pb-20 pt-24 text-white md:px-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-center gap-4 py-20">
          <p className="text-zinc-400">Campaign not found</p>
          <Button variant="default" onClick={() => window.history.back()} className="rounded bg-[#2845D6] text-white">
            Go back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0e13] px-5 pb-20 pt-24 text-white md:px-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        {/* Deposit / Activate section for pending campaigns */}
        {campaign.status === "pending" && (
          <div className="rounded border border-amber-500/30 bg-amber-500/5 px-6 py-3">
            <p className="font-medium text-amber-500">Campaign pending — complete deposit to activate</p>
          </div>
        )}

        {campaign.status === "active" && (
          <div className="rounded border border-emerald-500/30 bg-emerald-500/5 px-6 py-3">
            <p className="text-sm text-emerald-500">Campaign is active. Users can join and complete quests.</p>
          </div>
        )}

      <div className="flex gap-8">
        {/* Stepper */}
        <aside className="hidden w-40 flex-col gap-6 md:flex">
          {STEP_LABELS.map((label, index) => {
            const isActive = step === index;
            const isCompleted = step > index;
            return (
              <button
                key={label}
                type="button"
                onClick={() => setStep(index as 0 | 1 | 2)}
                className="flex items-center gap-3 text-left w-full"
              >
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full border text-sm font-semibold transition
                  ${isActive
                      ? "border-blue-500 bg-blue-600 text-white"
                      : isCompleted
                        ? "border-emerald-500 bg-emerald-600 text-white"
                        : "border-white/20 bg-transparent text-white/60"
                    }`}
                >
                  {index + 1}
                </div>
                <div className="flex flex-col">
                  <span className="text-xs uppercase tracking-wide text-white/50">
                    Step {index + 1}
                  </span>
                  <span className="text-sm font-medium text-white">
                    {label}
                  </span>
                </div>
              </button>
            );
          })}
        </aside>

        {/* Form */}
        <main className="flex-1">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-white">
                {step === 0 ? "Quest Info" : step === 1 ? "Rewards Info" : "Quest Activate"}
              </h1>
              <p className="mt-1 text-sm text-white/60">
                {step === 0
                  ? "Set up the basic information for your quest."
                  : step === 1
                    ? "Configure rewards and distribution for your quest."
                    : "Deposit USDC to escrow and activate your campaign."}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {saveDraftStatus === "saved" && (
                <span className="text-xs text-emerald-500">Draft saved</span>
              )}
              {saveDraftStatus === "error" && (
                <span className="text-xs text-red-500">Failed to save</span>
              )}
              <Button
                type="button"
                variant="default"
                disabled={saveDraftStatus === "saving"}
                className="border border-[#1A1A1A] rounded bg-black/40 text-xs text-white"
                onClick={handleSubmit(onSaveDraft)}
              >
                {saveDraftStatus === "saving" ? "Saving..." : "Save Draft"}
              </Button>
            </div>
          </div>

          <form
            className="space-y-10 rounded border border-white/10 bg-linear-to-b from-zinc-950/80 to-black/80 p-6 shadow-xl"
            onSubmit={handleSubmit(onSubmit)}
          >
            {step === 2 ? (
              <section className="space-y-6">
                <FieldGroup>
                  <h3 className="font-medium text-white">Deposit to Escrow</h3>
                  <p className="text-sm text-zinc-400">
                    Fund your campaign pool. A 0.5% platform fee applies.
                  </p>
                  <div className="rounded border border-[#1A1A1A] bg-black/40 p-4 space-y-2 max-w-md">
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-400">Pool amount (rewards)</span>
                      <span className="text-white">{poolAmount.toFixed(2)} USDC</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-400">Platform fee (0.5%)</span>
                      <span className="text-white">{feeAmount.toFixed(2)} USDC</span>
                    </div>
                    <div className="flex justify-between text-sm font-medium border-t border-[#1A1A1A] pt-2 mt-2">
                      <span>Total to deposit</span>
                      <span className="text-emerald-400">{depositAmount.toFixed(2)} USDC</span>
                    </div>
                  </div>
                  {!canDeposit ? (
                    <p className="text-sm text-amber-500">Fill Rewards Info (Step 1), Save Draft, then return here to set pool amount.</p>
                  ) : !isConnected ? (
                    <p className="text-sm text-amber-500">Connect your wallet to deposit.</p>
                  ) : (
                    <>
                      <Button
                        type="button"
                        onClick={async () => {
                          if (campaign.status === "draft") {
                            const ok = await handlePublish();
                            if (!ok) return;
                          }
                          setDepositDialogOpen(true);
                        }}
                        disabled={hasEnoughBalance || publishLoading}
                        className="rounded bg-[#48A111] text-white hover:bg-[#48A111]/80"
                      >
                        {publishLoading ? "Publishing..." : hasEnoughBalance ? "Deposited" : "Deposit USDC & Activate"}
                      </Button>
                      <DepositActivateDialog
                        open={depositDialogOpen}
                        onOpenChange={setDepositDialogOpen}
                        campaignId={campaign.id}
                        depositAmount={depositAmount}
                        onSuccess={handleDepositSuccess}
                      />
                    </>
                  )}
                  {balanceFormatted != null && (
                    <p className="text-xs text-zinc-500">Escrow balance: {balanceFormatted.toFixed(2)} USDC</p>
                  )}
                </FieldGroup>
              </section>
            ) : step === 0 ? (
              <section className="space-y-6">
                <FieldGroup>
                  {/* Partner name */}
                  <Controller
                    name="partnerName"
                    control={control}
                    render={({ field }) => (
                      <Field>
                        <FieldLabel>Partner name</FieldLabel>
                        <Input
                          {...field}
                          value={field.value ?? ""}
                          placeholder="e.g. Uniswap v3, Aave v3"
                          className="bg-black/40 text-sm text-white placeholder:text-white/30 rounded border border-[#1A1A1A]"
                        />
                      </Field>
                    )}
                  />

                  {/* Title */}
                  <Controller
                    name="title"
                    control={control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel>
                          Title <span className="text-red-500">*</span>
                        </FieldLabel>
                        <Input
                          {...field}
                          placeholder="Quest title"
                          className="bg-black/40 text-sm text-white placeholder:text-white/30 rounded border border-[#1A1A1A]"
                        />
                        {fieldState.invalid && (
                          <FieldError errors={[fieldState.error]} />
                        )}
                      </Field>
                    )}
                  />

                  {/* Description */}
                  <Controller
                    name="description"
                    control={control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel>Description</FieldLabel>
                        <RichTextEditor value={field.value} onChange={field.onChange} />
                      </Field>
                    )}
                  />

                  {/* Quest period */}
                  <Field>
                    <FieldLabel>
                      Quest Period <span className="text-red-500">*</span>
                    </FieldLabel>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Controller
                        name="periodStart"
                        control={control}
                        render={({ field, fieldState }) => (
                          <Field data-invalid={fieldState.invalid}>
                            <FieldDescription className="text-xs text-white/60">
                              Start date
                            </FieldDescription>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="default"
                                  id="quest-period-start"
                                  aria-invalid={fieldState.invalid}
                                  className="flex w-full items-center justify-start border border-[#1A1A1A] rounded bg-black/40 text-left text-sm font-normal text-white"
                                >
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {field.value
                                    ? new Date(field.value).toLocaleDateString()
                                    : "Select start date"}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent
                                className="w-auto overflow-hidden border border-[#1A1A1A] p-0 bg-black text-white"
                                align="start"
                              >
                                <Calendar
                                  mode="single"
                                  selected={
                                    field.value ? new Date(field.value) : undefined
                                  }
                                  captionLayout="dropdown"
                                  onSelect={(date) =>
                                    field.onChange(
                                      date ? date.toISOString() : ""
                                    )
                                  }
                                />
                              </PopoverContent>
                            </Popover>
                            {fieldState.invalid && (
                              <FieldError errors={[fieldState.error]} />
                            )}
                          </Field>
                        )}
                      />
                      <Controller
                        name="periodEnd"
                        control={control}
                        render={({ field, fieldState }) => (
                          <Field data-invalid={fieldState.invalid}>
                            <FieldDescription className="text-xs text-white/60">
                              End date
                            </FieldDescription>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="default"
                                  id="quest-period-end"
                                  aria-invalid={fieldState.invalid}
                                  className="flex w-full items-center justify-start border border-[#1A1A1A] rounded bg-black/40 text-left text-sm font-normal text-white"
                                >
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {field.value
                                    ? new Date(field.value).toLocaleDateString()
                                    : "Select end date"}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent
                                className="w-auto overflow-hidden border border-white/10 p-0 bg-black text-white"
                                align="start"
                              >
                                <Calendar
                                  mode="single"
                                  selected={
                                    field.value ? new Date(field.value) : undefined
                                  }
                                  captionLayout="dropdown"
                                  onSelect={(date) =>
                                    field.onChange(
                                      date ? date.toISOString() : ""
                                    )
                                  }
                                />
                              </PopoverContent>
                            </Popover>
                            {fieldState.invalid && (
                              <FieldError errors={[fieldState.error]} />
                            )}
                          </Field>
                        )}
                      />
                    </div>
                  </Field>

                  {/* Thumbnail */}
                  <Controller
                    name="thumbnail"
                    control={control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel>
                          Thumbnail <span className="text-red-500">*</span>
                        </FieldLabel>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                          <Button
                            type="button"
                            variant="default"
                            className="bg-black border border-[#1A1A1A] rounded text-white"
                            onClick={() =>
                              document
                                .getElementById("quest-thumbnail-input")
                                ?.click()
                            }
                          >
                            {previewUrl ? "Change image" : "Upload image"}
                            <Upload className="h-4 w-4" />
                          </Button>
                          <Input
                            id="quest-thumbnail-input"
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) =>
                              field.onChange(e.target.files ?? undefined)
                            }
                          />
                          {displayThumbnail && (
                            <div className="relative h-16 w-28 overflow-hidden rounded border border-white/15 bg-black/60">
                              <button
                                type="button"
                                onClick={handleClearThumbnail}
                                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/80 text-white/80 hover:bg-black hover:text-white"
                              >
                                <X className="h-3 w-3" />
                              </button>
                              <Image
                                src={displayThumbnail}
                                alt="Thumbnail preview"
                                className="h-full w-full object-cover"
                                width={100}
                                height={100}
                              />
                            </div>
                          )}
                        </div>
                        <FieldDescription className="text-xs text-white/40">
                          Recommended 800x400px or similar 2:1 ratio, JPG or
                          PNG.
                        </FieldDescription>
                        {fieldState.invalid && (
                          <FieldError errors={[fieldState.error]} />
                        )}
                      </Field>
                    )}
                  />
                </FieldGroup>
              </section>
            ) : (
              <section className="space-y-6">
                <FieldGroup>
                  {/* Token info */}
                  <Field>
                    <FieldLabel>
                      Token Info <span className="text-red-500">*</span>
                    </FieldLabel>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Controller
                        name="network"
                        control={control}
                        render={({ field, fieldState }) => (
                          <Field data-invalid={fieldState.invalid}>
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                            >
                              <SelectTrigger className="border border-[#1A1A1A] rounded bg-black/40 text-white">
                                <SelectValue placeholder="Select network" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="creditcoin">Creditcoin Testnet</SelectItem>
                              </SelectContent>
                            </Select>
                            {fieldState.invalid && (
                              <FieldError errors={[fieldState.error]} />
                            )}
                          </Field>
                        )}
                      />
                      <Controller
                        name="token"
                        control={control}
                        render={({ field, fieldState }) => (
                          <Field data-invalid={fieldState.invalid}>
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                            >
                              <SelectTrigger className="border border-[#1A1A1A] rounded bg-black/40 text-white">
                                <SelectValue placeholder="Select token" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="vael">VAEL</SelectItem>
                                <SelectItem value="usdc">USDC</SelectItem>
                                <SelectItem value="custom">
                                  Custom token
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            {fieldState.invalid && (
                              <FieldError errors={[fieldState.error]} />
                            )}
                          </Field>
                        )}
                      />
                    </div>
                  </Field>

                  {/* Token amount */}
                  <Controller
                    name="token_amount_per_winner"
                    control={control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel>
                          Token Amount (per winner){" "}
                          <span className="text-red-500">*</span>
                        </FieldLabel>
                        <Input
                          {...field}
                          type="number"
                          step="0.0001"
                          min={0}
                          placeholder="Enter amount, up to 4 decimal places"
                          className="border border-[#1A1A1A] rounded bg-black/40 text-white"
                        />
                        {fieldState.invalid && (
                          <FieldError errors={[fieldState.error]} />
                        )}
                      </Field>
                    )}
                  />

                  {/* Winners */}
                  <Controller
                    name="winners"
                    control={control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel>
                          Amount of Winners{" "}
                          <span className="text-red-500">*</span>
                        </FieldLabel>
                        <Input
                          {...field}
                          type="number"
                          min={1}
                          placeholder="How many winners do you want to select?"
                          className="border border-[#1A1A1A] rounded bg-black/40 text-white"
                        />
                        {fieldState.invalid && (
                          <FieldError errors={[fieldState.error]} />
                        )}
                      </Field>
                    )}
                  />
                </FieldGroup>
              </section>
            )}

            {/* Footer actions */}
            <div className="flex items-center justify-between border-t border-white/10 pt-6">
              <Button
                type="button"
                variant="default"
                onClick={goPrevious}
                disabled={step === 0}
                className="text-white border border-[#1A1A1A] rounded bg-[#BF092F] hover:bg-[#BF092F]/80"
              >
                Previous
              </Button>

              {step === 0 ? (
                <Button
                  type="button"
                  variant="default"
                  onClick={goNext}
                  className="text-white border border-[#1A1A1A] rounded bg-[#2845D6] hover:bg-[#2845D6]/80"
                >
                  Next
                </Button>
              ) : step === 1 ? (
                <Button
                  type="button"
                  variant="default"
                  onClick={goNext}
                  className="text-white border border-[#1A1A1A] rounded bg-[#2845D6] hover:bg-[#2845D6]/80"
                >
                  Next
                </Button>
              ) : (
                <div />
              )}
            </div>
          </form>
        </main>
      </div>
      </div>
    </div>
  );
}
