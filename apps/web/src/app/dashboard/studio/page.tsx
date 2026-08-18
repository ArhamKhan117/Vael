"use client";

import { DataTable } from '@/components/data-table';
import { useAccount } from 'wagmi';
import { api, type Campaign } from '@/lib/api';
import { useCampaignBalance } from '@/hooks/useCampaignEscrow';
import { CircleCheck, CircleDashed, Plus, Search, Trash2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ColumnDef } from "@tanstack/react-table";
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
  } from "@/components/ui/input-group"

type QuestType = {
    id: string;
    partner_wallet: string;
    title: string;
    template_type: string;
    description: string;
    thumbnail: string;
    status: string;
    participants: number;
    claimed_count: number;
    period_start: string;
    period_end: string;
    network: string;
    token: string;
    token_amount_per_winner: string;
    distribution: string;
    updatedAt: string;
    createdAt: string;
}

function campaignToQuestType(c: Campaign): QuestType {
    return {
        id: c.id,
        partner_wallet: c.partner_wallet,
        title: c.title,
        template_type: c.template_type,
        description: c.description ?? "",
        thumbnail: c.thumbnail ?? "https://picsum.photos/seed/quest/600/400",
        status: c.status === "active" ? "PUBLISHED" : "NOT_PUBLISHED",
        participants: c.participant_count ?? 0,
        claimed_count: c.claimed_count ?? 0,
        period_start: c.start_at ?? "",
        period_end: c.end_at ?? "",
        network: "creditcoin",
        token: (c.pool_token ?? "USDC").toLowerCase(),
        token_amount_per_winner: String(c.reward_per_quest_usdc ?? 0),
        distribution: "raffle",
        updatedAt: c.updated_at,
        createdAt: c.created_at,
    };
}

const CENTER_ITEMS: {
    key: string;
    label: string;
    title: string;
    description: string;
}[] = [
        {
            key: "/partnership",
            label: "Partnership",
            title: "Partnership",
            description: "Fund a campaign and pay out only on verified proofs.",
        },
        {
            key: "/quest",
            label: "Quests",
            title: "Quests",
            description: "Browse proof-verified quests and earn VAEL, badges, and hero XP.",
        },
    ];

export default function StudioPage() {
    const router = useRouter();
    const { address, isConnected } = useAccount();
    const [questData, setQuestData] = useState<QuestType[]>([]);
    const [selectedRowId, setSelectedRowId] = useState<string[]>([]);
    const [isDeleteQuestDialogOpen, setIsDeleteQuestDialogOpen] = useState(false);
    const [selectedQuest, setSelectedQuest] = useState<QuestType | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(true);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const { balanceFormatted } = useCampaignBalance(selectedQuest?.id ?? null);

    const columns: ColumnDef<QuestType>[] = [
        {
            accessorKey: "title",
            header: "Title",
            cell: ({ row }) => (
                <div className="max-w-[240px] truncate">
                    {row.getValue("title")}
                </div>
            ),
        },
        {
            accessorKey: "thumbnail",
            header: "Thumbnail Images",
            cell: ({ row }) => {
                return (
                    <div className="flex items-center -space-x-2 max-w-[200px]">
                        <Image
                            src={row.getValue("thumbnail")}
                            alt="Thumbnail images"
                            width={48}
                            height={36}
                            className="h-[36px] w-[48px] object-cover rounded"
                            loading="lazy"
                        />
                    </div>
                );
            },
        },
        {
            accessorKey: "participants",
            header: "Participants",
            cell: ({ row }) => (
                <div className="max-w-[240px] truncate">
                    {row.getValue("participants")}
                </div>
            ),
        },
        {
            accessorKey: "token_amount_per_winner",
            header: "Token Amount per Winner",
            cell: ({ row }) => (
                <div className="max-w-[240px] truncate">
                    {row.getValue("token_amount_per_winner")}
                </div>
            ),
        },
        {
            accessorKey: "token",
            header: "Token",
            cell: ({ row }) => (
                <div className="max-w-[240px] truncate">
                    <span className='uppercase'>{row.getValue("token")}</span>
                </div>
            ),
        },
        {
            accessorKey: "status",
            header: "Status",
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    {row.getValue("status") === "PUBLISHED" ? (
                        <CircleCheck className="h-4 w-4" color="#03A01A" />
                    ) : (
                        <CircleDashed className="h-4 w-4" />
                    )}
                    <span
                        className={`${row.getValue("status") === "PUBLISHED" ? "text-[#03A01A]" : ""
                            }`}
                    >
                        {row.getValue("status") === "PUBLISHED" ? "Published" : "Draft"}
                    </span>
                </div>
            ),
        },
        {
            accessorKey: "updatedAt",
            header: "Last Updated",
            cell: ({ row }) => {
                const formatted = row.getValue("updatedAt")
                    ? new Date(row.getValue("updatedAt")).toLocaleString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true,
                    })
                    : "";
                return <div>{formatted}</div>;
            },
        },
        {
            id: "delete",
            enableHiding: false,
            cell: ({ row }) => (
                <div>
                    <Trash2
                        className="w-4 h-4 text-[#9B1515]"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDeleteEventDialog(row.original);
                        }}
                    />
                </div>
            ),
        },
    ];

    const fetchCampaigns = useCallback(async () => {
        setLoading(true);
        try {
            const { campaigns } = await api.listCampaigns({
                partner: isConnected && address ? address : undefined,
                limit: 100,
            });
            setQuestData(campaigns.map(campaignToQuestType));
        } catch (err) {
            console.error("Failed to fetch campaigns:", err);
            setQuestData([]);
        } finally {
            setLoading(false);
        }
    }, [isConnected, address]);

    useEffect(() => {
        fetchCampaigns();
    }, [fetchCampaigns]);

    const filteredQuests = useMemo(() => {
        if (!searchTerm.trim()) return questData;
        const query = searchTerm.toLowerCase();
        return questData.filter((quest) =>
            quest.title.toLowerCase().includes(query)
        );
    }, [questData, searchTerm]);

    const handleRowClick = useCallback((row: QuestType) => {
        router.push(`/dashboard/studio/edit-quest/${row.id}`);
    }, [router]);

    const handleSelectionRowChange = useCallback((rows: QuestType[]) => {
        const selectedIds = rows.map((row: QuestType) => row.id);
        setSelectedRowId(selectedIds);
    }, []);

    const handleOpenDeleteEventDialog = useCallback((row: QuestType) => {
        setSelectedQuest(row);
        setDeleteError(null);
        setIsDeleteQuestDialogOpen(true);
    }, []);

    const participantCount = selectedQuest?.participants ?? 0;
    const claimedCount = selectedQuest?.claimed_count ?? 0;
    const rewardPerQuest = selectedQuest ? Number(selectedQuest.token_amount_per_winner ?? 0) : 0;
    const remainingAllocated = Math.max(0, participantCount - claimedCount) * rewardPerQuest;
    const refundableAmount =
        balanceFormatted != null && remainingAllocated < balanceFormatted
            ? balanceFormatted - remainingAllocated
            : 0;
    const isPartner =
        address &&
        selectedQuest?.partner_wallet &&
        address.toLowerCase() === selectedQuest.partner_wallet.toLowerCase();
    const canWithdraw =
        isPartner &&
        refundableAmount > 0.001;

    const handleConfirmDelete = useCallback(async () => {
        if (!selectedQuest) return;
        setDeleteError(null);
        setDeleteLoading(true);
        try {
            if (canWithdraw) {
                await api.requestRefund(selectedQuest.id, selectedQuest.partner_wallet);
            }
            await api.deleteCampaign(selectedQuest.id);
            setQuestData((prev) => prev.filter((q) => q.id !== selectedQuest.id));
            setIsDeleteQuestDialogOpen(false);
            setSelectedQuest(null);
        } catch (err) {
            const msg = (err as Error)?.message ?? "Failed";
            setDeleteError(
                msg.includes("No refundable amount")
                    ? "Refund failed: escrow balance not found. Ensure CAMPAIGN_ESCROW_ADDRESS in API matches the contract you deposited to. Do not delete—funds would be stuck."
                    : msg
            );
        } finally {
            setDeleteLoading(false);
        }
    }, [selectedQuest, canWithdraw]);

    return (
        <>
            <div className="min-h-screen bg-[#0d0e13] px-5 pb-20 pt-24 text-white md:px-10">
                <div className='max-w-7xl mx-auto'>
                    <div className="space-y-8">
                        <div className='flex flex-col md:flex-row gap-4 items-center justify-between p-8 border border-[#1A1A1A] rounded bg-[linear-gradient(to_right,#2845D6,#0d0e13_60%)]'>
                            <div className="space-y-2">
                                <h1 className="text-3xl font-semibold tracking-tight text-white">
                                    Quests
                                </h1>
                                <p className="text-sm text-zinc-400 max-w-2xl">
                                    Create and manage promotional quests for your project.
                                    Reward users with tokens when they complete on-chain.
                                </p>
                            </div>
                            <Link href="/dashboard/studio/create-quest">
                                <Button variant="default" className="text-white border border-[#1A1A1A] rounded bg-[#2845D6] hover:bg-[#2845D6]/80">
                                    <Plus className="w-4 h-4" />
                                    Create Quest
                                </Button>
                            </Link>
                        </div>

                        <div className='space-y-4'>
                            {!isConnected && (
                                <p className="text-sm text-amber-500">Connect your wallet to view and manage your campaigns.</p>
                            )}
                            {loading ? (
                                <p className="text-sm text-zinc-400">Loading campaigns...</p>
                            ) : (
                            <>
                            <InputGroup className="max-w-xs border border-[#1A1A1A] rounded bg-black text-white">
                                <InputGroupInput
                                    placeholder="Search quest..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                                <InputGroupAddon>
                                    <Search className="w-4 h-4" />
                                </InputGroupAddon>
                            </InputGroup>
                            <DataTable
                                key={questData.map((row) => row.id).join(",")}
                                columns={columns}
                                data={filteredQuests}
                                // onSelectionChange={handleSelectionChange}
                                onSelectedRowsChange={handleSelectionRowChange}
                                onRowClick={handleRowClick}
                            />
                            </>
                            )}
                        </div>
                    </div>
                </div>

                <Dialog open={isDeleteQuestDialogOpen} onOpenChange={setIsDeleteQuestDialogOpen}>
                    <DialogContent className="sm:max-w-sm bg-black border border-[#1A1A1A] rounded text-white">
                        <DialogHeader>
                            <DialogTitle>Delete selected quest?</DialogTitle>
                            <DialogDescription>
                                You are about to permanently delete the selected quest. This action cannot be undone.
                                {canWithdraw && (
                                    <span className="mt-2 block text-emerald-400">
                                        {refundableAmount.toFixed(2)} USDC will be withdrawn to your wallet, then the campaign will be deleted.
                                    </span>
                                )}
                            </DialogDescription>
                        </DialogHeader>
                        {deleteError && (
                            <p className="text-sm text-amber-400 mt-2">{deleteError}</p>
                        )}
                        <DialogFooter>
                            <DialogClose asChild>
                                <Button variant="default" className="rounded bg-white text-black text-xs hover:bg-white/80">Cancel</Button>
                            </DialogClose>
                            <Button
                                type="button"
                                onClick={handleConfirmDelete}
                                disabled={deleteLoading}
                                className="rounded bg-[#9B1515] text-white text-xs hover:bg-[#9B1515]/80"
                            >
                                {deleteLoading
                                    ? canWithdraw
                                        ? "Withdrawing & Deleting..."
                                        : "Deleting..."
                                    : canWithdraw
                                        ? `Delete & Withdraw ${refundableAmount.toFixed(2)} USDC`
                                        : "Delete"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </>

    )
}
