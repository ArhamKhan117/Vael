export function FaqSection() {
    return (
        <section>
            <div className="">
                <div className="space-y-3 border-b border-[#1A1A1A] p-10">
                    {/* <p className="text-[11px] font-semibold tracking-[0.22em] text-zinc-500">
                QUESTIONS
              </p> */}
                    <h2 className="text-2xl font-semibold md:text-3xl">FAQ</h2>
                    <p className="text-xs text-zinc-400 md:text-sm">
                        Everything you need to know about running and joining Vael quests.
                    </p>
                </div>

                <div className="divide-y divide-[#1A1A1A]">
                    {/* Getting started */}
                    <div>
                        <div className="border-b border-[#1A1A1A] px-10 py-4 text-sm font-semibold uppercase tracking-[0.22em] text-zinc-500">
                            Getting started
                        </div>
                        <details className="group border-b border-[#1A1A1A] p-10">
                            <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-white">
                                <span>What is Vael?</span>
                                <span className="text-xs text-zinc-500 group-open:hidden">+</span>
                                <span className="hidden text-xs text-zinc-500 group-open:inline">
                                    -
                                </span>
                            </summary>
                            <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                                Vael is a cross-chain quest game on Creditcoin. You perform real DeFi
                                actions on Ethereum Sepolia, such as a swap on Uniswap v3 or a
                                supply on Aave v3. The Attestcoin Protocol proves that transaction
                                on Creditcoin, where QuestASC verifies the proof on-chain and
                                releases VAEL, a soul-bound badge, hero XP, and raid damage.
                            </p>
                        </details>

                        <details className="group p-10">
                            <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-white">
                                <span>How do I get started?</span>
                                <span className="text-xs text-zinc-500 group-open:hidden">+</span>
                                <span className="hidden text-xs text-zinc-500 group-open:inline">
                                    -
                                </span>
                            </summary>
                            <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                                Connect your wallet and switch to Creditcoin testnet. Complete your
                                profile, then browse quests. Accept a quest on Creditcoin, switch to
                                Ethereum Sepolia to perform the action, and the proof does the rest.
                                Daily and weekly quests are generated for you after your profile is
                                complete.
                            </p>
                        </details>
                    </div>

                    {/* XP, rewards & badges */}
                    <div>
                        <div className="border-b border-[#1A1A1A] px-10 py-4 text-sm font-semibold uppercase tracking-[0.22em] text-zinc-500">
                            XP, rewards & badges
                        </div>
                        <details className="group border-b border-[#1A1A1A] p-10">
                            <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-white">
                                <span>What rewards can i earn?</span>
                                <span className="text-xs text-zinc-500 group-open:hidden">+</span>
                                <span className="hidden text-xs text-zinc-500 group-open:inline">
                                    -
                                </span>
                            </summary>
                            <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                                You earn VAEL, our native reward token, soul-bound Badge NFTs for each
                                completion at levels 1 to 10, and XP that levels your hero and moves
                                you up the leaderboard. Daily quests typically reward 50 VAEL and
                                50 XP; weekly quests offer 200 VAEL and 100 XP. Every reward is
                                released by the contract that verified your proof.
                            </p>
                        </details>

                        <details className="group border-b border-[#1A1A1A] p-10">
                            <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-white">
                                <span>How does the XP and leveling system work?</span>
                                <span className="text-xs text-zinc-500 group-open:hidden">+</span>
                                <span className="hidden text-xs text-zinc-500 group-open:inline">
                                    -
                                </span>
                            </summary>
                            <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                                Every verified proof grants XP to your hero, and XP is spent to
                                level up rather than accumulated: leaving level L costs 100 + 50 x L
                                XP, so level 1 to 2 costs 150, level 2 to 3 costs 200, and so on.
                                One large action can carry you through several levels at once. The
                                action also raises the stat it belongs to, and the highest stat
                                decides which hero you see. All of it lives in VaelHero on
                                Creditcoin, which accepts writes only from QuestASC.
                            </p>
                        </details>

                        <details className="group p-10">
                            <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-white">
                                <span>What is a Badge NFT?</span>
                                <span className="text-xs text-zinc-500 group-open:hidden">+</span>
                                <span className="hidden text-xs text-zinc-500 group-open:inline">
                                    -
                                </span>
                            </summary>
                            <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                                Badge NFTs are unique non-fungible tokens (ERC-721) minted
                                automatically when you complete a quest. Each badge corresponds
                                to a level (1-10) and features unique artwork stored on IPFS.
                                Badges are soul-bound: they cannot be transferred or sold, so they are a
                                real record of what you did. You can view all of yours in your
                                profile's rewards section.
                            </p>
                        </details>
                    </div>

                    {/* Quests & completion */}
                    <div>
                        <div className="border-b border-[#1A1A1A] px-10 py-4 text-sm font-semibold uppercase tracking-[0.22em] text-zinc-500">
                            Quests & completion
                        </div>
                        <details className="group border-b border-[#1A1A1A] p-10">
                            <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-white">
                                <span>How do daily and weekly quests work?</span>
                                <span className="text-xs text-zinc-500 group-open:hidden">+</span>
                                <span className="hidden text-xs text-zinc-500 group-open:inline">
                                    -
                                </span>
                            </summary>
                            <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                                Daily quests reset every 24 hours and offer 50 VAEL + 50 XP. Weekly
                                quests reset every Monday and offer 200 VAEL + 100 XP. Both are
                                AI-generated and personalized for each user. After completing your
                                profile, you'll automatically receive your first daily and weekly
                                quest. These quests are created by our AI agent and deployed on-chain
                                as smart contract quests.
                            </p>
                        </details>

                        <details className="group border-b border-[#1A1A1A] p-10">
                            <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-white">
                                <span>How does quest completion work?</span>
                                <span className="text-xs text-zinc-500 group-open:hidden">+</span>
                                <span className="hidden text-xs text-zinc-500 group-open:inline">
                                    -
                                </span>
                            </summary>
                            <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                                First, accept the quest on Creditcoin. That records the latest attested
                                Sepolia block, so only an action you take afterwards can count. Next,
                                perform the action on Ethereum Sepolia. Attestors attest the block
                                on Creditcoin, which takes about eight minutes, and a proof is built
                                for your exact transaction. QuestASC verifies that proof through the
                                block prover precompile and releases VAEL, your badge, hero XP, and
                                raid damage in the same transaction. No backend key is involved: you
                                can submit the proof yourself from your own wallet.
                            </p>
                        </details>

                        <details className="group border-b border-[#1A1A1A] p-10">
                            <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-white">
                                <span>Which DeFi protocols are supported?</span>
                                <span className="text-xs text-zinc-500 group-open:hidden">+</span>
                                <span className="hidden text-xs text-zinc-500 group-open:inline">
                                    -
                                </span>
                            </summary>
                            <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                                Vael decodes five action types on Ethereum Sepolia: Vael Quest Portal
                                check-ins and deposits, Uniswap v3 swaps, ERC-20 transfers, and Aave
                                v3 supply and borrow. PenguinSwap quests run natively on Creditcoin.
                                Each quest states exactly which contract must emit the event for the
                                proof to verify.
                            </p>
                        </details>

                        <details className="group p-10">
                            <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-white">
                                <span>How does the leaderboard work?</span>
                                <span className="text-xs text-zinc-500 group-open:hidden">+</span>
                                <span className="hidden text-xs text-zinc-500 group-open:inline">
                                    -
                                </span>
                            </summary>
                            <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                                The leaderboard ranks users based on their total XP earned from
                                completing quests. Your rank updates in real-time as you complete
                                quests and earn XP. Users with 0 XP are unranked. You can view your
                                rank on your profile page and compete with other users to climb
                                to the top. Every point on it traces back to a verified proof, so the
                                ranking cannot be gamed off-chain.
                            </p>
                        </details>
                    </div>

                    {/* Fees, troubleshooting & wallets */}
                    <div>
                        <div className="border-b border-[#1A1A1A] px-10 py-4 text-sm font-semibold uppercase tracking-[0.22em] text-zinc-500">
                            Fees, troubleshooting & wallets
                        </div>
                        <details className="group border-b border-[#1A1A1A] p-10">
                            <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-white">
                                <span>Do I need to pay gas fees?</span>
                                <span className="text-xs text-zinc-500 group-open:hidden">+</span>
                                <span className="hidden text-xs text-zinc-500 group-open:inline">
                                    -
                                </span>
                            </summary>
                            <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                                You need tCTC on Creditcoin testnet to accept quests and submit proofs,
                                and Sepolia ETH for the source action itself. Reading attestation
                                data is free; you only ever pay network gas. All fees are visible
                                before you confirm a transaction.
                            </p>
                        </details>

                        <details className="group border-b border-[#1A1A1A] p-10">
                            <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-white">
                                <span>What happens if my quest submission fails?</span>
                                <span className="text-xs text-zinc-500 group-open:hidden">+</span>
                                <span className="hidden text-xs text-zinc-500 group-open:inline">
                                    -
                                </span>
                            </summary>
                            <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                                If a proof fails to verify you will see the on-chain reason. Common ones
                                are: the source block is not attested yet, the emitting contract is
                                not allowlisted for that action, the decoded player does not match
                                the accepting wallet, the amount is below the minimum, or the action
                                happened before you accepted the quest. Proof material also perishes,
                                so a stale proof is refetched and resubmitted automatically.
                            </p>
                        </details>

                        <details className="group p-10">
                            <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-white">
                                <span>Where can I view my VAEL and Badge NFTs?</span>
                                <span className="text-xs text-zinc-500 group-open:hidden">+</span>
                                <span className="hidden text-xs text-zinc-500 group-open:inline">
                                    -
                                </span>
                            </summary>
                            <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                                VAEL is a standard ERC-20 and Badge NFTs are ERC-721, both on Creditcoin
                                testnet. Your wallet may need the token address imported manually.
                                Your profile page shows total VAEL earned and every badge, with
                                artwork from IPFS. Everything is verifiable on Blockscout.
                            </p>
                        </details>
                    </div>

                    {/* Vael Studio & creators */}
                    <div>
                        <div className="border-b border-[#1A1A1A] px-10 py-4 text-sm font-semibold uppercase tracking-[0.22em] text-zinc-500">
                            Vael Studio & creators
                        </div>
                        <details className="group border-b border-[#1A1A1A] p-10">
                            <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-white">
                                <span>What is Vael Studio?</span>
                                <span className="text-xs text-zinc-500 group-open:hidden">+</span>
                                <span className="hidden text-xs text-zinc-500 group-open:inline">
                                    -
                                </span>
                            </summary>
                            <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                                Vael Studio is a campaign dashboard where projects create and manage quest campaigns. Partners design tasks, fund an escrow, and set rewards. Payouts release only when QuestASC has verified a proof, so a partner never pays for engagement that did not happen.
                            </p>
                        </details>

                        <details className="group border-b border-[#1A1A1A] p-10">
                            <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-white">
                                <span>Who can create quests in Vael Studio?</span>
                                <span className="text-xs text-zinc-500 group-open:hidden">+</span>
                                <span className="hidden text-xs text-zinc-500 group-open:inline">
                                    -
                                </span>
                            </summary>
                            <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                                Any project or community member can create quests using Vael Studio. It
                                is designed for teams that want to promote their protocols, launch
                                campaigns, or incentivize genuine on-chain engagement.
                            </p>
                        </details>

                        <details className="group border-b border-[#1A1A1A] p-10">
                            <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-white">
                                <span>How do users participate in a quest?</span>
                                <span className="text-xs text-zinc-500 group-open:hidden">+</span>
                                <span className="hidden text-xs text-zinc-500 group-open:inline">
                                    -
                                </span>
                            </summary>
                            <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                                Users complete the on-chain action described in the quest on Ethereum
                                Sepolia. The Attestcoin proof of that transaction is then verified
                                on Creditcoin, which is what releases the reward.
                            </p>
                        </details>

                        <details className="group border-b border-[#1A1A1A] p-10">
                            <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-white">
                                <span>Can I edit or delete a quest after creating it?</span>
                                <span className="text-xs text-zinc-500 group-open:hidden">+</span>
                                <span className="hidden text-xs text-zinc-500 group-open:inline">
                                    -
                                </span>
                            </summary>
                            <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                                Yes. Vael Studio lets creators edit quest details, update rewards, adjust
                                campaign settings, or delete quests that are no longer needed.
                            </p>
                        </details>
                    </div>
                </div>
            </div>
        </section>
    );
}

