// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ICompletionHook} from "../../src/interfaces/ICompletionHook.sol";

/// @notice Hooks that misbehave in each of the ways a real one might.
/// @dev The point of these is that none of them can stop a reward being paid.

/// @notice Reverts every time.
contract RevertingHook is ICompletionHook {
    error Nope();

    function onQuestCompleted(uint64, uint256, address, uint8, address, uint256, uint8, uint64, bytes32)
        external
        pure
    {
        revert Nope();
    }
}

/// @notice Burns far more gas than the per-hook allowance.
contract GasBurningHook is ICompletionHook {
    mapping(uint256 => uint256) private _sink;

    function onQuestCompleted(uint64, uint256, address, uint8, address, uint256, uint8, uint64, bytes32)
        external
    {
        for (uint256 i = 0; i < 10_000; ++i) {
            _sink[i] = i + 1;
        }
    }
}

/// @notice Records what it was told, so a test can assert the hook actually ran.
contract RecordingHook is ICompletionHook {
    uint256 public calls;
    address public lastPlayer;
    uint8 public lastActionType;
    uint8 public lastTier;
    uint64 public lastSourceBlock;
    bytes32 public lastReplayKey;

    function onQuestCompleted(
        uint64,
        uint256,
        address player,
        uint8 actionType,
        address,
        uint256,
        uint8 tier,
        uint64 sourceBlock,
        bytes32 replayKey
    ) external {
        calls += 1;
        lastPlayer = player;
        lastActionType = actionType;
        lastTier = tier;
        lastSourceBlock = sourceBlock;
        lastReplayKey = replayKey;
    }
}
