"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useCampaignEscrow } from "@/hooks/useCampaignEscrow";
import { Loader2, RefreshCw, Check, X, Hourglass } from "lucide-react";
import { cn } from "@/lib/utils";

type StepStatus = "pending" | "queued" | "in_progress" | "completed" | "failed";

interface StepState {
  status: StepStatus;
  txHash?: string;
  error?: string;
}

function shortHash(hash: string | undefined): string {
  if (!hash) return "—";
  if (hash.startsWith("0x")) {
    return hash.length > 10 ? `${hash.slice(0, 6)}...${hash.slice(-4)}` : hash;
  }
  return hash.length > 10 ? `${hash.slice(0, 6)}...${hash.slice(-4)}` : hash;
}

interface DepositActivateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  depositAmount: number;
  onSuccess?: () => void;
}

const STEPS = [
  { id: "approve", label: "Approve reward token", contractLabel: "ERC-20" },
  { id: "deposit", label: "Deposit to Escrow", contractLabel: "CampaignEscrow" },
  { id: "activate", label: "Activate Campaign", contractLabel: "—" },
] as const;

export function DepositActivateDialog({
  open,
  onOpenChange,
  campaignId,
  depositAmount,
  onSuccess,
}: DepositActivateDialogProps) {
  const { approveRewardToken, deposit } = useCampaignEscrow();
  const [steps, setSteps] = useState<Record<string, StepState>>({
    approve: { status: "pending" },
    deposit: { status: "pending" },
    activate: { status: "pending" },
  });
  const [isRunning, setIsRunning] = useState(false);

  const setStepState = useCallback(
    (id: string, state: Partial<StepState>) => {
      setSteps((prev) => ({
        ...prev,
        [id]: { ...prev[id], ...state },
      }));
    },
    []
  );

  const runFlow = useCallback(async () => {
    if (!campaignId || depositAmount <= 0 || isRunning) return;
    setIsRunning(true);

    setSteps({
      approve: { status: "pending" },
      deposit: { status: "pending" },
      activate: { status: "pending" },
    });

    let depositTxHash: string | undefined;
    let currentStep: "approve" | "deposit" | "activate" = "approve";

    try {
      // Step 1: Approve
      currentStep = "approve";
      setStepState("approve", { status: "in_progress", error: undefined });
      setStepState("deposit", { status: "queued" });
      setStepState("activate", { status: "queued" });
      const approveHash = await approveRewardToken(depositAmount);
      setStepState("approve", { status: "completed", txHash: approveHash });

      // Step 2: Deposit (pass approveHash so we wait for NEW tx, not stale approve confirmation)
      currentStep = "deposit";
      setStepState("deposit", { status: "in_progress", error: undefined });
      depositTxHash = await deposit(campaignId, depositAmount, approveHash);
      setStepState("deposit", { status: "completed", txHash: depositTxHash });

      // Step 3: Activate
      currentStep = "activate";
      setStepState("activate", { status: "in_progress", error: undefined });
      await api.activateCampaign(campaignId, depositTxHash);
      setStepState("activate", { status: "completed" });

      // Brief pause so React can render the checkmark before countdown
      await new Promise((r) => setTimeout(r, 400));
      // Keep dialog open 7s to show success, then close
      await new Promise((r) => setTimeout(r, 7000));
      onSuccess?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setStepState(currentStep, { status: "failed", error: msg });
    } finally {
      setIsRunning(false);
    }
  }, [campaignId, depositAmount, approveRewardToken, deposit, onSuccess, setStepState, isRunning]);

  const handleRetry = useCallback(() => {
    runFlow();
  }, [runFlow]);

  const hasStartedRef = React.useRef(false);
  useEffect(() => {
    if (!open) {
      hasStartedRef.current = false;
      return;
    }
    if (open && campaignId && depositAmount > 0 && !hasStartedRef.current) {
      hasStartedRef.current = true;
      runFlow();
    }
  }, [open, campaignId, depositAmount, runFlow]);

  const StatusIcon = ({ status }: { status: StepStatus }) => {
    if (status === "in_progress" || status === "queued")
      return <Loader2 className="h-4 w-4 animate-spin text-white/60" />;
    if (status === "completed") return <Check className="h-4 w-4 text-emerald-500" />;
    if (status === "failed") return <X className="h-4 w-4 text-red-500" />;
    return <Hourglass className="h-4 w-4 text-white/40" />;
  };

  const StatusText = ({ status }: { status: StepStatus }) => {
    if (status === "in_progress") return "In Progress";
    if (status === "queued") return ">> Queued";
    if (status === "completed") return "Completed";
    if (status === "failed") return "Failed";
    return "Pending";
  };

  const allCompleted = STEPS.every((s) => (steps[s.id]?.status ?? "pending") === "completed");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-xl border-[#1A1A1A] bg-black text-white"
        showCloseButton={true}
      >
        <DialogHeader>
          <DialogTitle className="text-lg text-white">
            {allCompleted ? "Campaign activated!" : "Depositing to escrow..."}
          </DialogTitle>
        </DialogHeader>
        <div className="mt-2">
          <div className="overflow-hidden rounded-lg border border-[#1A1A1A]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1A1A1A] bg-white/5">
                  <th className="px-4 py-3 text-left font-medium text-white/70">
                    Tx Hash
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-white/70">
                    Description
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-white/70">
                    Status
                  </th>
                  <th className="w-12 px-2 py-3" />
                </tr>
              </thead>
              <tbody>
                {STEPS.map((step) => {
                  const state = steps[step.id] ?? { status: "pending" as StepStatus };
                  return (
                    <tr
                      key={step.id}
                      className="border-b border-[#1A1A1A]/80 last:border-0"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-white/80">
                        {step.id === "activate"
                          ? "—"
                          : shortHash(state.txHash) || step.contractLabel}
                      </td>
                      <td className="px-4 py-3 text-white/90">{step.label}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <StatusIcon status={state.status} />
                          <span
                            className={cn(
                              state.status === "completed" && "text-emerald-500",
                              state.status === "failed" && "text-red-500",
                              state.status === "in_progress" && "text-white",
                              (state.status === "pending" || state.status === "queued") &&
                                "text-white/60"
                            )}
                          >
                            <StatusText status={state.status} />
                          </span>
                        </div>
                        {state.error && (
                          <p className="mt-1 text-xs text-red-500">{state.error}</p>
                        )}
                      </td>
                      <td className="px-2 py-3">
                        {state.status === "failed" && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-white/70 hover:text-white"
                            onClick={handleRetry}
                            disabled={isRunning}
                          >
                            <RefreshCw className="h-4 w-4" />
                            <span className="sr-only">Retry</span>
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
