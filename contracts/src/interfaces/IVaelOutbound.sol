// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IVaelOutbound
/// @notice What Vael would publish back onto a source chain once Attestcoin writability ships.
///
/// @dev **Declaration only. There is no implementation and there is not meant to be one yet.**
/// Attestcoin today proves one direction: a transaction on Ethereum becomes a fact Creditcoin can
/// verify. Writability is the return leg, letting Creditcoin state become a fact Ethereum can
/// verify, and it is not live. Writing this interface now is not speculation for its own sake: it
/// pins down what Vael would say, so the shape of the game does not quietly drift into something
/// that cannot be published.
///
/// Two publications, and only two. Both are statements about something the chain already proved,
/// never instructions to move value on the strength of a message.
///
/// 1. `publishRewardClaim` lets a player redeem on Ethereum what they earned on Creditcoin.
/// 2. `publishBadgeAttestation` lets a badge earned here be read by a contract there.
///
/// What does **not** change when writability ships:
/// - Quest completion still happens only through `QuestASC` on a verified inbound proof. Nothing
///   here can complete a quest, and nothing here is a second way to be paid.
/// - Every field below is derived from state the chain already holds. There is no argument a caller
///   supplies that the chain has not already agreed to, which is the same rule that governs the
///   inbound direction: a caller-supplied field sitting outside the proof is exactly how a valid
///   proof gets aimed at the wrong interpretation.
/// - The replay ledger stays log-scoped. An outbound publication carries the same `replayKey` the
///   inbound proof burned, so the two directions can be reconciled against one identifier.
interface IVaelOutbound {
    /// @notice A reward earned on Creditcoin, published for redemption on a source chain.
    /// @dev `amount` is the reward the quest promised, read from QuestManager, not a number the
    /// caller passes. `replayKey` is the key QuestASC burned when it verified the completion, so a
    /// redeemer on the source chain can check that this claim corresponds to exactly one proof.
    /// @param destinationChainKey Attestcoin chain key of the chain to publish onto.
    /// @param player The address that completed the quest, taken from the proved log.
    /// @param questId The quest, on the Creditcoin QuestManager that recorded it.
    /// @param rewardToken Token the reward is denominated in on Creditcoin.
    /// @param amount Reward the quest promised, in that token's units.
    /// @param replayKey The log-scoped key QuestASC burned for this completion.
    /// @param completedAtBlock Creditcoin height the completion landed in.
    /// @return publicationId Identifier of the publication, for reconciliation.
    function publishRewardClaim(
        uint64 destinationChainKey,
        address player,
        uint256 questId,
        address rewardToken,
        uint256 amount,
        bytes32 replayKey,
        uint64 completedAtBlock
    ) external returns (bytes32 publicationId);

    /// @notice A badge earned on Creditcoin, published so a contract elsewhere can read it.
    /// @dev Deliberately carries no transferable claim. A badge is soul-bound here and the
    /// publication says only that an address holds one; anything on the far side that wants to gate
    /// on it reads the attestation rather than receiving a token.
    /// @param destinationChainKey Attestcoin chain key of the chain to publish onto.
    /// @param holder The address that holds the badge.
    /// @param tokenId Badge token id on the Creditcoin BadgeNFT.
    /// @param badgeLevel Level the badge was minted at.
    /// @param rarity Rarity as BadgeNFT records it, 0 Common through 4 Legendary.
    /// @param questId Quest the badge was minted for, or the season for a raid badge.
    /// @param replayKey The completion that earned it, or bytes32(0) for a badge with no single
    /// proof behind it, such as a raid victory earned by a community.
    /// @return publicationId Identifier of the publication, for reconciliation.
    function publishBadgeAttestation(
        uint64 destinationChainKey,
        address holder,
        uint256 tokenId,
        uint256 badgeLevel,
        uint8 rarity,
        uint256 questId,
        bytes32 replayKey
    ) external returns (bytes32 publicationId);

    /// @notice Emitted when a reward claim is published.
    event RewardClaimPublished(
        bytes32 indexed publicationId,
        uint64 indexed destinationChainKey,
        address indexed player,
        uint256 questId,
        uint256 amount,
        bytes32 replayKey
    );

    /// @notice Emitted when a badge attestation is published.
    event BadgeAttestationPublished(
        bytes32 indexed publicationId,
        uint64 indexed destinationChainKey,
        address indexed holder,
        uint256 tokenId,
        uint8 rarity,
        bytes32 replayKey
    );
}
