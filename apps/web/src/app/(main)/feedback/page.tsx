
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useAccount } from "wagmi";
import { useProfile } from "@/hooks/useProfile";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import Link from "next/link";

type FeedbackItem = {
    id: number;
    name: string;
    role: string;
    message: string;
    rating?: number;
};

type FeedbackFormValues = {
    name: string;
    role: string;
    message: string;
    rating: string;
};

export default function FeedbackPage() {
    const { address, isConnected } = useAccount();
    const { stats } = useProfile(address ?? null);

    const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const { control, handleSubmit, reset } = useForm<FeedbackFormValues>({
        defaultValues: {
            name: "",
            role: "",
            message: "",
            rating: "",
        },
    });

    const hasProfile = !!(stats?.name?.trim() && stats?.email?.trim());

    useEffect(() => {
        const loadFeedback = async () => {
            setLoading(true);
            try {
                const res = await api.listFeedback({ limit: 50 });
                const dynamicFeedback: FeedbackItem[] = (res.feedback ?? []).map(
                    (item) => ({
                        id: item.id,
                        name: item.name || item.username || "Community member",
                        role:
                            item.role ||
                            (item.wallet_address
                                ? `On-chain user ${item.wallet_address.slice(0, 6)}…${item.wallet_address.slice(-4)}`
                                : "Community member"),
                        message: item.message,
                        rating: item.rating,
                    }),
                );
                // Replace feedback with fresh data from API
                setFeedback(dynamicFeedback);
            } catch (err) {
                console.error("Failed to load feedback", err);
            } finally {
                setLoading(false);
            }
        };

        loadFeedback();
    }, []);

    const averageRating = useMemo(() => {
        const rated = feedback.filter((f) => typeof f.rating === "number");
        if (!rated.length) return null;
        const sum = rated.reduce((acc, f) => acc + (f.rating ?? 0), 0);
        return (sum / rated.length).toFixed(1);
    }, [feedback]);

    const onSubmit = async (values: FeedbackFormValues) => {
        setError(null);
        setSuccess(null);

        if (!isConnected || !address) {
            setError("Please connect your wallet before submitting feedback.");
            return;
        }

        if (!hasProfile) {
            setError("Please complete your profile (name & email) before submitting feedback.");
            return;
        }

        if (!values.name.trim() || !values.message.trim()) {
            setError("Please provide at least your name and some feedback.");
            return;
        }

        const numericRating = Number(values.rating);
        if (!values.rating || Number.isNaN(numericRating)) {
            setError("Rating is required and must be a number between 1 and 5.");
            return;
        }

        if (numericRating < 1 || numericRating > 5) {
            setError("Rating should be between 1 and 5.");
            return;
        }

        setSubmitting(true);

        try {
            const payload = {
                name: values.name.trim(),
                role: values.role.trim(),
                wallet_address: address,
                username: stats?.name?.trim() || values.name.trim(),
                rating: numericRating,
                message: values.message.trim(),
            };

            const res = await api.createFeedback(payload);

            const created = res.feedback;
            setFeedback((prev) => [
                {
                    id: created.id,
                    name: created.name || created.username || values.name.trim(),
                    role:
                        created.role ||
                        (created.wallet_address
                            ? `On-chain user ${created.wallet_address.slice(0, 6)}…${created.wallet_address.slice(-4)}`
                            : values.role.trim() || "Community member"),
                    message: created.message,
                    rating: created.rating,
                },
                ...prev,
            ]);

            reset();
            setSuccess("Thank you for sharing your feedback!");
        } catch (err) {
            console.error("Failed to submit feedback", err);
            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to submit feedback. Please try again.",
            );
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <main className="min-h-screen bg-black px-5 pb-20 pt-24 text-white md:px-10">
            <div className="space-y-8">
                <section>
                    <div className="mx-auto flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                        <div className="space-y-3">
                            <p className="text-[11px] font-semibold tracking-[0.22em] text-sky-400">
                                FEEDBACK
                            </p>
                            <h1 className="text-2xl font-semibold md:text-3xl">
                                Hear from the Vael community.
                            </h1>
                            <p className="max-w-xl text-xs leading-relaxed text-zinc-400 md:text-sm">
                                Read what builders and users are saying about Vael, and share your own
                                experience to help us improve the quest platform.
                            </p>
                        </div>

                        {averageRating && (
                            <div className="mt-2 rounded border border-zinc-800 bg-zinc-950/60 p-4 text-xs md:text-sm">
                                <p className="text-zinc-400">Average rating</p>
                                <p className="mt-1 text-2xl font-semibold text-white">
                                    {averageRating}
                                    <span className="text-sm text-zinc-500"> / 5</span>
                                </p>
                                <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                                    Based on community feedback
                                </p>
                            </div>
                        )}
                    </div>
                </section>

                <section className="grid gap-8 border border-[#1A1A1A] p-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.3fr)] md:p-10">
                    {/* Submit feedback */}
                    <div className="space-y-5">
                        <h2 className="text-lg font-semibold md:text-xl">Share your feedback</h2>
                        <p className="text-xs leading-relaxed text-zinc-400 md:text-sm">
                            Tell us how Vael is working for you, what you&apos;d like to see next, or
                            any rough edges you&apos;ve noticed. Your input directly shapes upcoming
                            quests and product improvements.
                        </p>

                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4"> 
                            <Controller
                                name="name"
                                control={control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel>
                                            Name <span className="text-red-500">*</span>
                                        </FieldLabel>
                                        <Input
                                            {...field}
                                            placeholder="How should we refer to you?"
                                            className="bg-black/40 text-sm text-white placeholder:text-white/30 rounded border border-[#1A1A1A]"
                                        />
                                        {fieldState.invalid && (
                                            <FieldError errors={[fieldState.error]} />
                                        )}
                                    </Field>
                                )}
                            />

                            <Controller
                                name="role"
                                control={control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel>
                                            Role <span className="text-red-500">*</span>
                                        </FieldLabel>
                                        <Input
                                            {...field}
                                            placeholder="e.g. Community lead, DeFi user, protocol team"
                                            className="bg-black/40 text-sm text-white placeholder:text-white/30 rounded border border-[#1A1A1A]"
                                        />
                                        {fieldState.invalid && (
                                            <FieldError errors={[fieldState.error]} />
                                        )}
                                    </Field>
                                )}
                            />

                            <Controller
                                name="message"
                                control={control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel>
                                            Feedback <span className="text-red-500">*</span>
                                        </FieldLabel>
                                        <Textarea
                                            {...field}
                                            rows={4}
                                            placeholder="Share your experience using Vael, ideas for quests, or any issues you ran into."
                                            className="bg-black/40 text-sm text-white placeholder:text-white/30 rounded border border-[#1A1A1A]"
                                        />
                                        {fieldState.invalid && (
                                            <FieldError errors={[fieldState.error]} />
                                        )}
                                    </Field>
                                )}
                            />

                            <Controller
                                name="rating"
                                control={control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel>
                                            Rating <span className="text-red-500">*</span>
                                        </FieldLabel>
                                        <Input
                                            {...field}
                                            type="number"
                                            min={1}
                                            max={5}
                                            placeholder="1–5"
                                            className="bg-black/40 text-sm text-white placeholder:text-white/30 rounded border border-[#1A1A1A]"
                                        />
                                        {fieldState.invalid && (
                                            <FieldError errors={[fieldState.error]} />
                                        )}
                                    </Field>
                                )}
                            />

                            {error && (
                                <p className="text-xs text-red-400">
                                    {error}
                                </p>
                            )}

                            {success && (
                                <p className="text-xs text-emerald-400">
                                    {success}
                                </p>
                            )}

                            <Button
                                type="submit"
                                disabled={submitting || loading}
                                className="rounded bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/80 disabled:opacity-60"
                            >
                                {submitting ? "Submitting..." : "Submit feedback"}
                            </Button>

                            <p className="text-[11px] leading-relaxed text-zinc-500">
                                You can only submit feedback when your wallet is connected and your
                                profile is complete.{" "}
                                {!isConnected || !hasProfile ? (
                                    <>
                                        Visit the{" "}
                                        <Link href="/profile" className="underline underline-offset-2">
                                            Profile
                                        </Link>{" "}
                                        page to connect your wallet and complete your profile.
                                    </>
                                ) : null}
                            </p>
                        </form>
                    </div>

                    {/* Feedback list */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between gap-2">
                            <h2 className="text-lg font-semibold md:text-xl">Community feedback</h2>
                            <span className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                                {feedback.length} ENTRIES
                            </span>
                        </div>

                        <div className="space-y-4">
                            {loading && (
                                <p className="text-xs text-zinc-500 md:text-sm">
                                    Loading community feedback...
                                </p>
                            )}
                            {feedback.map((item) => (
                                <div
                                    key={item.id}
                                    className="rounded border border-zinc-800 bg-zinc-950/60 p-4"
                                >
                                    <p className="text-xs leading-relaxed text-zinc-200 md:text-sm">
                                        “{item.message}”
                                    </p>
                                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs md:text-sm">
                                        <div>
                                            <p className="font-semibold text-white">{item.name}</p>
                                            <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                                                {item.role}
                                            </p>
                                        </div>
                                        {typeof item.rating === "number" && (
                                            <div className="inline-flex items-center gap-1 rounded-full border border-zinc-700 px-2 py-1 text-[11px] text-zinc-200">
                                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                                {item.rating.toFixed(1)} / 5
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {feedback.length === 0 && (
                                <p className="text-xs text-zinc-500 md:text-sm">
                                    No feedback yet. Be the first to share your thoughts about Vael.
                                </p>
                            )}
                        </div>
                    </div>
                </section>
            </div>
        </main>
    );
}
