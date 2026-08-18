"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Calendar as CalendarIcon, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAccount } from "wagmi";
import { useRouter, useSearchParams } from "next/navigation";
import { api, type Campaign } from "@/lib/api";
import { useDepositAmountForPool } from "@/hooks/useCampaignEscrow";
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
import { DepositActivateDialog } from "@/components/deposit-activate-dialog";

const questSchema = z
  .object({
    // Step 1
    partnerName: z.string().optional(),
    title: z.string().min(1, "Title is required"),
    description: z
      .string()
      .min(1, "Description is required")
      .refine(
        (val) => val.replace(/<[^>]*>/g, "").trim().length > 0,
        "Description cannot be empty"
      ),
    periodStart: z.string().min(1, "Start date is required"),
    periodEnd: z.string().min(1, "End date is required"),
    thumbnail: z.any().optional(),
    thumbnailUrl: z.union([z.string().url(), z.literal("")]).optional(),
    // Step 2
    template_type: z.enum(["swap", "deposit", "borrow", "stake", "other"], {
      required_error: "Quest type is required",
    }),
    template_type_custom: z.string().optional(),
    protocol_address: z
      .string()
      .min(1, "Protocol address is required")
      .refine(
        (v) => /^0x[a-fA-F0-9]{40}$/.test(v),
        { message: "Protocol address must be 0x + exactly 40 hex characters (e.g. 0x0000000000000000000000000000000000004b40)" }
      ),
    token: z.string().min(1, "Token is required"),
    token_amount_per_winner: z.union([z.string(), z.number()])
      .refine((v) => v !== "" && v !== undefined && v !== null, "Token amount is required")
      .refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0, {
        message: "Token amount must be a positive number",
      }),
    winners: z.union([z.string(), z.number()])
      .refine((v) => v !== "" && v !== undefined && v !== null, "Number of winners is required")
      .refine((v) => Number.isInteger(Number(v)) && Number(v) > 0, {
        message: "Winners must be a positive integer",
      }),
  })
  .refine(
    (data) =>
      !data.periodStart ||
      !data.periodEnd ||
      new Date(data.periodEnd) >= new Date(data.periodStart),
    {
      message: "End date must be after start date",
      path: ["periodEnd"],
    }
  );

type QuestFormValues = z.infer<typeof questSchema>;

const STEP_LABELS = ["Quest Info", "Rewards Info", "Quest Activate"] as const;

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function getThumbnailForApi(values: QuestFormValues): Promise<string | undefined> {
  const files = values.thumbnail;
  const file = files && (Array.isArray(files) ? files[0] : (files as FileList)?.[0]);
  if (file instanceof File) {
    return fileToBase64(file);
  }
  const url = values.thumbnailUrl?.trim();
  return Promise.resolve(url || undefined);
}

type ProtocolOption = { name: string; evmAddress: string; category: string };

function CreateQuestPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const draftIdFromUrl = searchParams?.get("draft");
  const { address, isConnected } = useAccount();
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [protocols, setProtocols] = useState<ProtocolOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [createdCampaign, setCreatedCampaign] = useState<Campaign | null>(null);
  const [draftCampaignId, setDraftCampaignId] = useState<string | null>(draftIdFromUrl);
  const [error, setError] = useState<string | null>(null);
  const [depositDialogOpen, setDepositDialogOpen] = useState(false);
  const [protocolIsOther, setProtocolIsOther] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);

  const form = useForm<QuestFormValues>({
    resolver: zodResolver(questSchema),
    shouldUnregister: false,
    defaultValues: {
      partnerName: "",
      title: "",
      description: "<p>Quest description</p>",
      periodStart: "",
      periodEnd: "",
      template_type: undefined,
      template_type_custom: "",
      protocol_address: "",
      token: "usdc",
      token_amount_per_winner: "",
      winners: "",
      thumbnailUrl: "",
    },
  });

  const {
    control,
    register,
    handleSubmit,
    getValues,
    trigger,
    watch,
    setValue,
    formState: { errors },
  } = form;

  const STEP_0_FIELDS: (keyof QuestFormValues)[] = ["title", "description", "periodStart", "periodEnd"];
  const STEP_1_FIELDS: (keyof QuestFormValues)[] = ["template_type", "protocol_address", "token_amount_per_winner", "winners"];

  const tokenPerWinner = watch("token_amount_per_winner");
  const winners = watch("winners");
  const poolAmount = (Number(tokenPerWinner) || 0) * (Number(winners) || 0);
  const { depositAmount, feeAmount } = useDepositAmountForPool(poolAmount);

  const thumbnailFiles = watch("thumbnail");
  const thumbnailUrl = watch("thumbnailUrl");

  useEffect(() => {
    api.getProtocols().then((res) => {
      setProtocols(
        res.protocols.map((p) => ({
          name: p.name,
          evmAddress: p.evmAddress,
          category: p.category,
        }))
      );
    }).catch(console.error);
  }, []);

  useEffect(() => {
    const id = draftIdFromUrl;
    if (!id) return;
    api
      .getCampaign(id)
      .then((c) => {
        setValue("title", c.title);
        setValue("description", c.description ?? "<p></p>");
        setValue("partnerName", c.partner_name ?? "");
        setValue("periodStart", c.start_at ?? "");
        setValue("periodEnd", c.end_at ?? "");
        setValue("thumbnailUrl", c.thumbnail ?? "");
        if (c.template_type) setValue("template_type", c.template_type as QuestFormValues["template_type"]);
        const tp = c.template_params as Record<string, unknown> | undefined;
        if (tp?.protocol_address) setValue("protocol_address", String(tp.protocol_address));
        setValue("token", (c.pool_token ?? "usdc").toLowerCase());
        const pool = Number(c.pool_amount) || 0;
        const maxP = c.max_participants || 1;
        setValue("token_amount_per_winner", maxP > 0 ? String(pool / maxP) : "");
        setValue("winners", String(maxP));
        setDraftCampaignId(c.id);
      })
      .catch(() => {});
  }, [draftIdFromUrl, setValue]);

  const previewUrl = useMemo(() => {
    if (thumbnailUrl?.trim()) return thumbnailUrl;
    if (thumbnailFiles && thumbnailFiles.length > 0 && thumbnailFiles[0] instanceof File) {
      return URL.createObjectURL(thumbnailFiles[0]);
    }
    return null;
  }, [thumbnailFiles, thumbnailUrl]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleClearThumbnail = () => {
    setValue("thumbnail", undefined);
    setValue("thumbnailUrl", "");
    const input = document.getElementById(
      "quest-thumbnail-input"
    ) as HTMLInputElement | null;
    if (input) {
      input.value = "";
    }
  };

  const onSubmit = async (values: QuestFormValues) => {
    if (!isConnected || !address) {
      setError("Please connect your wallet");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const tokenPerWinner = Number(values.token_amount_per_winner);
      const maxParticipants = Number(values.winners);
      const poolAmt = tokenPerWinner * maxParticipants;
      const thumbnail = await getThumbnailForApi(values);
      const templateParams: Record<string, unknown> = {
        protocol_address: values.protocol_address,
      };
      if (values.template_type === "other" && values.template_type_custom) {
        templateParams.custom_type = values.template_type_custom;
      }

      let campaign: Campaign;
      if (draftCampaignId) {
        await api.updateCampaign(draftCampaignId, {
          title: values.title,
          description: values.description,
          partner_name: values.partnerName?.trim() || null,
          start_at: values.periodStart,
          end_at: values.periodEnd,
          pool_amount: poolAmt,
          max_participants: maxParticipants,
          pool_token: values.token,
          thumbnail: thumbnail || null,
          template_type: values.template_type,
          template_params: templateParams,
        });
        await api.updateCampaignStatus(draftCampaignId, "pending");
        campaign = await api.getCampaign(draftCampaignId);
      } else {
        campaign = await api.createCampaign({
          partner_wallet: address,
          partner_name: values.partnerName?.trim() || undefined,
          title: values.title,
          template_type: values.template_type as "swap" | "deposit" | "borrow" | "stake" | "other",
          template_params: templateParams,
          description: values.description,
          thumbnail: thumbnail || undefined,
          pool_amount: poolAmt,
          max_participants: maxParticipants,
          period_start: values.periodStart,
          period_end: values.periodEnd,
        });
      }
      setCreatedCampaign(campaign);
      setDraftCampaignId(null);
      setStep(2);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create campaign");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDepositSuccess = () => {
    setDepositDialogOpen(false);
    router.push(`/dashboard/studio/edit-quest/${createdCampaign?.id}`);
  };

  const onSaveDraft = async (values: QuestFormValues) => {
    if (!isConnected || !address) {
      setError("Connect your wallet to save draft");
      return;
    }
    if (!values.title?.trim()) {
      setError("Title is required to save draft");
      return;
    }
    setError(null);
    try {
      const tokenPerWinner = Number(values.token_amount_per_winner) || 0;
      const maxParticipants = Number(values.winners) || 1;
      const poolAmt = tokenPerWinner * maxParticipants;
      const thumbnail = await getThumbnailForApi(values);
      const templateParams: Record<string, unknown> = values.protocol_address
        ? { protocol_address: values.protocol_address, ...(values.template_type === "other" && values.template_type_custom && { custom_type: values.template_type_custom }) }
        : {};

      if (draftCampaignId) {
        await api.updateCampaign(draftCampaignId, {
          title: values.title,
          description: values.description,
          partner_name: values.partnerName?.trim() || null,
          start_at: values.periodStart || undefined,
          end_at: values.periodEnd || undefined,
          pool_amount: poolAmt,
          max_participants: maxParticipants,
          pool_token: values.token,
          thumbnail: thumbnail || null,
          ...(Object.keys(templateParams).length > 0 && { template_type: values.template_type, template_params: templateParams }),
        });
      } else {
        const c = await api.createCampaignDraft({
          partner_wallet: address,
          partner_name: values.partnerName?.trim() || undefined,
          title: values.title,
          description: values.description,
          thumbnail,
          period_start: values.periodStart || undefined,
          period_end: values.periodEnd || undefined,
          template_type: values.template_type,
          template_params: Object.keys(templateParams).length > 0 ? templateParams : undefined,
          pool_amount: poolAmt || undefined,
          max_participants: maxParticipants > 0 ? maxParticipants : undefined,
          pool_token: values.token,
        });
        setDraftCampaignId(c.id);
      }
      setDraftSaved(true);
      setTimeout(() => setDraftSaved(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save draft");
    }
  };

  const getValidationErrors = (errs: Record<string, unknown>): string => {
    const messages: string[] = [];
    for (const [key, val] of Object.entries(errs)) {
      if (val && typeof val === "object" && "message" in val && typeof (val as { message?: unknown }).message === "string") {
        messages.push(`${key}: ${(val as { message: string }).message}`);
      }
    }
    return messages.length > 0 ? messages.join(" | ") : "Please fix the form errors.";
  };

  const goNext = async () => {
    setError(null);
    if (step === 0) {
      const valid = await trigger(STEP_0_FIELDS);
      if (valid) setStep(1);
      else setError(getValidationErrors(form.formState.errors as Record<string, unknown>));
    } else if (step === 1) {
      const valid = await trigger(STEP_1_FIELDS);
      if (valid) {
        handleSubmit(
          onSubmit,
          (errs: Record<string, unknown>) => setError(getValidationErrors(errs))
        )();
      } else {
        setError(getValidationErrors(form.formState.errors as Record<string, unknown>));
      }
    }
  };

  const goPrevious = () => {
    if (step === 1) setStep(0);
    else if (step === 2) setStep(1);
  };

  return (
    <div className="min-h-screen bg-[#0d0e13] px-5 pb-20 pt-24 text-white md:px-10">
      <div className="mx-auto flex max-w-7xl gap-8">
        {/* Stepper */}
        <aside className="hidden w-40 flex-col gap-6 md:flex">
          {STEP_LABELS.map((label, index) => {
            const isActive = step === index;
            const isCompleted = step > index;
            return (
              <div key={label} className="flex items-center gap-3">
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
              </div>
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
              {draftSaved && (
                <span className="text-xs text-emerald-500">Draft saved locally</span>
              )}
              <Button
                type="button"
                variant="default"
                className="border border-[#1A1A1A] rounded bg-black/40 text-xs text-white"
                onClick={() => onSaveDraft(getValues())}
              >
                Save Draft
              </Button>
            </div>
          </div>

          <form
            className="space-y-10 rounded border border-white/10 bg-linear-to-b from-zinc-950/80 to-black/80 p-6 shadow-xl"
            onSubmit={(e) => { e.preventDefault(); if (step === 1) handleSubmit(onSubmit)(e); }}
          >
            {/* Step 2 - Deposit: always in DOM, visibility by step */}
            <section className={step === 2 ? "space-y-6" : "hidden"}>
                <FieldGroup>
                  <h3 className="font-medium text-white">Deposit to Escrow</h3>
                  <p className="text-sm text-zinc-400">
                    Fund your campaign pool. A 0.5% platform fee applies.
                  </p>
                  <div className="rounded border border-[#1A1A1A] bg-black/40 p-4 space-y-2">
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
                  {error && <p className="text-sm text-red-500">{error}</p>}
                  {!isConnected ? (
                    <p className="text-sm text-amber-500">Connect your wallet to deposit.</p>
                  ) : (
                    <>
                      <Button
                        type="button"
                        onClick={() => setDepositDialogOpen(true)}
                        disabled={poolAmount <= 0}
                        className="rounded bg-[#48A111] text-white hover:bg-[#48A111]/80"
                      >
                        Deposit USDC & Activate
                      </Button>
                      {createdCampaign && (
                        <DepositActivateDialog
                          open={depositDialogOpen}
                          onOpenChange={setDepositDialogOpen}
                          campaignId={createdCampaign.id}
                          depositAmount={depositAmount}
                          onSuccess={handleDepositSuccess}
                        />
                      )}
                    </>
                  )}
                </FieldGroup>
            </section>

            {/* Step 0 - Quest Info: always in DOM */}
            <section className={step === 0 ? "space-y-6" : "hidden"}>
                <FieldGroup>
                  {error && (
                    <p className="text-sm text-red-500">{error}</p>
                  )}
                  {/* Partner name */}
                  <Controller
                    name="partnerName"
                    control={control}
                    render={({ field, fieldState }) => (
                      <Field>
                        <FieldLabel>
                          Partner name <span className="text-red-500">*</span>
                        </FieldLabel>
                        <Input
                          {...field}
                          // value={field.value ?? ""}
                          placeholder="e.g. Uniswap v3, Aave v3"
                          className="bg-black/40 text-sm text-white placeholder:text-white/30 rounded border border-[#1A1A1A]"
                        />
                        {fieldState.invalid && (
                          <FieldError errors={[fieldState.error]} />
                        )}
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
                        <FieldLabel>
                          Description <span className="text-red-500">*</span>
                        </FieldLabel>
                        <RichTextEditor value={field.value} onChange={field.onChange} />
                        {fieldState.invalid && (
                          <FieldError errors={[fieldState.error]} />
                        )}
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
                    render={({ field }) => (
                      <Field>
                        <FieldLabel>Thumbnail (optional)</FieldLabel>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                          <Controller
                            name="thumbnailUrl"
                            control={control}
                            render={({ field }) => (
                              <Input
                                {...field}
                                placeholder="Or paste image URL"
                                className="max-w-xs bg-black/40 text-white border border-[#1A1A1A]"
                              />
                            )}
                          />
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
                          {previewUrl && (
                            <div className="relative h-16 w-28 overflow-hidden rounded border border-white/15 bg-black/60">
                              <button
                                type="button"
                                onClick={handleClearThumbnail}
                                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/80 text-white/80 hover:bg-black hover:text-white"
                              >
                                <X className="h-3 w-3" />
                              </button>
                              <Image
                                src={previewUrl}
                                alt="Thumbnail preview"
                                className="h-full w-full object-cover"
                                width={100}
                                height={100}
                              />
                            </div>
                          )}
                        </div>
                        <FieldDescription className="text-xs text-white/40">
                          Paste image URL or upload. Recommended 800x400px.
                        </FieldDescription>
                      </Field>
                    )}
                  />
                </FieldGroup>
            </section>

            {/* Step 1 - Rewards Info: always in DOM */}
            <section className={step === 1 ? "space-y-6" : "hidden"}>
                <FieldGroup>
                  {error && (
                    <p className="text-sm text-red-500">{error}</p>
                  )}
                  {/* Quest type & Protocol */}
                  <Field>
                    <FieldLabel>
                      Quest Type & Protocol <span className="text-red-500">*</span>
                    </FieldLabel>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Controller
                        name="template_type"
                        control={control}
                        render={({ field, fieldState }) => (
                          <Field data-invalid={fieldState.invalid}>
                            <Select
                              value={field.value ?? ""}
                              onValueChange={(v) => {
                                field.onChange(v === "" ? undefined : v);
                                if (v !== "other") setValue("template_type_custom", "");
                              }}
                            >
                              <SelectTrigger className="border border-[#1A1A1A] rounded bg-black/40 text-white">
                                <SelectValue placeholder="Select quest type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="swap">Swap</SelectItem>
                                <SelectItem value="deposit">Deposit / Liquidity</SelectItem>
                                <SelectItem value="borrow">Borrow / Lend</SelectItem>
                                <SelectItem value="stake">Stake</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                            {field.value === "other" && (
                              <Input
                                {...register("template_type_custom")}
                                placeholder="e.g. Custom action type"
                                className="mt-2 border border-[#1A1A1A] rounded bg-black/40 text-white"
                              />
                            )}
                            {fieldState.invalid && (
                              <FieldError errors={[fieldState.error]} />
                            )}
                          </Field>
                        )}
                      />
                      <Controller
                        name="protocol_address"
                        control={control}
                        render={({ field, fieldState }) => {
                          const val = (field.value || "").trim().toLowerCase();
                          const matched = protocols.find((p) => p.evmAddress.toLowerCase() === val);
                          const selectValue = protocolIsOther
                            ? "other"
                            : !val
                              ? "__none__"
                              : matched
                                ? matched.evmAddress
                                : "other";
                          return (
                            <Field data-invalid={fieldState.invalid}>
                              <Select
                                value={selectValue}
                                onValueChange={(v) => {
                                  if (v === "__none__" || v === "") {
                                    setProtocolIsOther(false);
                                    field.onChange("");
                                  } else if (v === "other") {
                                    setProtocolIsOther(true);
                                    field.onChange("");
                                  } else {
                                    setProtocolIsOther(false);
                                    field.onChange(v);
                                  }
                                }}
                              >
                                <SelectTrigger className="border border-[#1A1A1A] rounded bg-black/40 text-white">
                                  <SelectValue placeholder="Select protocol" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">
                                    <span className="text-zinc-500">Select protocol</span>
                                  </SelectItem>
                                  {protocols.map((p) => (
                                    <SelectItem key={p.evmAddress} value={p.evmAddress}>
                                      {p.name} ({p.category})
                                    </SelectItem>
                                  ))}
                                  <SelectItem value="other">Other (enter address manually)</SelectItem>
                                </SelectContent>
                              </Select>
                              {selectValue === "other" && (
                                <Input
                                  value={field.value}
                                  onChange={(e) => field.onChange(e.target.value)}
                                  placeholder="0x... (protocol address, 40 hex chars)"
                                  className="mt-2 border border-[#1A1A1A] rounded bg-black/40 text-white font-mono text-sm"
                                />
                              )}
                              {fieldState.invalid && (
                                <FieldError errors={[fieldState.error]} />
                              )}
                            </Field>
                          );
                        }}
                      />
                    </div>
                  </Field>
                  <Controller
                    name="token"
                    control={control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel>Reward Token</FieldLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger className="border border-[#1A1A1A] rounded bg-black/40 text-white">
                            <SelectValue placeholder="Select token" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="usdc">USDC</SelectItem>
                          </SelectContent>
                        </Select>
                        {fieldState.invalid && (
                          <FieldError errors={[fieldState.error]} />
                        )}
                      </Field>
                    )}
                  />

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
                  onClick={() => goNext()}
                  className="text-white border border-[#1A1A1A] rounded bg-[#2845D6] hover:bg-[#2845D6]/80"
                >
                  Next
                </Button>
              ) : step === 1 ? (
                <Button
                  type="button"
                  variant="default"
                  disabled={submitting}
                  onClick={() => goNext()}
                  className="text-white border border-[#1A1A1A] rounded bg-[#48A111] hover:bg-[#48A111]/80"
                >
                  {submitting ? "Creating..." : "Next: Deposit & Activate"}
                </Button>
              ) : (
                <div />
              )}
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}

export default function CreateQuestPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0d0e13] flex items-center justify-center text-white">Loading...</div>}>
      <CreateQuestPageContent />
    </Suspense>
  );
}
