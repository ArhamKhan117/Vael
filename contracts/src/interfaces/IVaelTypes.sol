// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title VaelTypes
/// @notice Shared types across QuestManager and QuestASC.
/// @dev They live here so the two contracts can reference each other through interfaces without a
/// circular import.
library VaelTypes {
    /// @notice The five source-chain actions a quest can be satisfied by.
    /// @dev Only `Portal` is decoded today. The rest revert `ActionNotYetSupported` in QuestASC and
    /// land in milestone 3b. The enum is complete from the start so a rule stored now keeps its meaning.
    enum ActionType {
        Portal,
        UniswapSwap,
        Erc20Transfer,
        AaveSupply,
        AaveBorrow,
        /// @dev Creditcoin-native, performed by NativePortal rather than proved. Attestcoin attests
        /// other chains to Creditcoin and not Creditcoin to itself, so a PenguinSwap swap has no
        /// proof to carry; NativePortal executes it and completes the quest in the same
        /// transaction instead. See docs/ATTESTCOIN_INTEGRATION.md section 9.
        PenguinSwapSwap,
        /// @dev Also native: wrapping CTC into WCTC, which is what a player needs before their
        /// first PenguinSwap trade.
        WrapNative
    }

    /// @notice First action type that is executed natively rather than proved.
    /// @dev Anything below it goes through QuestASC and an Attestcoin proof; anything from here up
    /// goes through NativePortal. Kept as a constant so the boundary is one place, not a list of
    /// enum members repeated in three contracts.
    uint8 internal constant FIRST_NATIVE_ACTION = uint8(ActionType.PenguinSwapSwap);

    /// @notice What a proved log must look like to satisfy one quest.
    /// @dev Every field here narrows what counts. Nothing in it can widen acceptance, which is why
    /// it is safe for the quest-creating agent to supply it: the worst a bad rule can do is make a
    /// quest impossible, never make it payable by the wrong person.
    struct VerificationRule {
        /// @dev Which decoder handles the log.
        ActionType actionType;
        /// @dev Exact emitting contract. Zero means any emitter allowlisted for this action type.
        address emitter;
        /// @dev Required token. Zero means any.
        address token;
        /// @dev Minimum amount in token units, or wei for a native portal check-in.
        uint256 minAmount;
        /// @dev Earliest source block. Zero means use the height anchored at acceptance.
        uint64 minSourceBlock;
        /// @dev Latest source block. Zero means no ceiling beyond quest expiry.
        uint64 maxSourceBlock;
        /// @dev Whether the decoded player must equal the accepting participant.
        bool playerMustMatch;
    }
}
