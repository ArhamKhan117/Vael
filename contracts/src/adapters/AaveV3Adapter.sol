// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {EvmV1Decoder} from "@gluwa/asc-contracts/contracts/common/EvmV1Decoder.sol";

import {IActionAdapter} from "../interfaces/IActionAdapter.sol";
import {VaelTypes} from "../interfaces/IVaelTypes.sol";

/// @title AaveV3Adapter
/// @notice Decodes Aave v3 `Supply` and `Borrow` from the Pool.
///
/// @dev Both events indexed the same way, which is why one adapter handles both:
///
///   Supply(address indexed reserve, address user, address indexed onBehalfOf,
///          uint256 amount, uint16 indexed referralCode)
///   Borrow(address indexed reserve, address user, address indexed onBehalfOf,
///          uint256 amount, uint256 interestRateMode, uint256 borrowRate,
///          uint16 indexed referralCode)
///
/// The player is `onBehalfOf` from `topics[2]`, not `user` from the data. `user` is whoever called
/// the Pool, which behind a gateway or a router is a contract; `onBehalfOf` is the account whose
/// position actually changed. Crediting `user` would let a gateway satisfy every quest.
contract AaveV3Adapter is IActionAdapter {
    /// @notice `Supply(address,address,address,uint256,uint16)`.
    bytes32 public constant SUPPLY_TOPIC =
        0x2b627736bca15cd5381dcf80b0bf11fd197d01a037c52b927a881a10fb73ba61;

    /// @notice `Borrow(address,address,address,uint256,uint8,uint256,uint16)`.
    bytes32 public constant BORROW_TOPIC =
        0xb3d084820fb1a9decffb176436bd02558d15fac9b0ddfed8c465bc7359d7dce0;

    function decode(uint64, EvmV1Decoder.LogEntry memory logEntry)
        external
        pure
        returns (bool, uint8, address, address, uint256, uint256)
    {
        bytes32 topic0 = logEntry.topics[0];
        uint8 actionType;
        if (topic0 == SUPPLY_TOPIC) {
            actionType = uint8(VaelTypes.ActionType.AaveSupply);
        } else if (topic0 == BORROW_TOPIC) {
            actionType = uint8(VaelTypes.ActionType.AaveBorrow);
        } else {
            return (false, 0, address(0), address(0), 0, 0);
        }

        // reserve, onBehalfOf, referralCode are indexed, so four topics. Data begins with `user`
        // then `amount`, so at least two words.
        if (logEntry.topics.length != 4 || logEntry.data.length < 64) {
            return (false, 0, address(0), address(0), 0, 0);
        }

        address reserve = address(uint160(uint256(logEntry.topics[1])));
        address player = address(uint160(uint256(logEntry.topics[2]))); // onBehalfOf
        (, uint256 amount) = abi.decode(logEntry.data, (address, uint256));

        return (true, actionType, player, reserve, amount, 0);
    }
}
