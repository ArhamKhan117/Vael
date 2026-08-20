// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {EvmV1Decoder} from "@gluwa/asc-contracts/contracts/common/EvmV1Decoder.sol";

import {IActionAdapter} from "../interfaces/IActionAdapter.sol";
import {VaelTypes} from "../interfaces/IVaelTypes.sol";

/// @title UniswapV3SwapAdapter
/// @notice Decodes a Uniswap v3 pool `Swap`.
///
/// @dev A v3 `Swap` reports two signed amounts from the pool's point of view: positive is what the
/// pool received, negative is what it paid out. The **input** side is therefore the positive one,
/// and that is what a quest's `minAmount` should be written against, because it is the side the
/// player actually committed. Reading the negative side would let a player satisfy a "swap at least
/// X" quest by receiving X from a favourable price, which they do not control.
///
/// The pool registry lives here because the token that goes with each amount is a property of the
/// pool, not of the log: `amount0` means token0 and only the pool knows which address that is.
/// QuestASC still decides *whether* a pool is allowed, through its own emitter allowlist. This
/// registry answers a different question: given that it is allowed, what are its tokens.
contract UniswapV3SwapAdapter is IActionAdapter, Ownable {
    /// @notice `Swap(address,address,int256,int256,uint160,uint128,int24)`.
    bytes32 public constant TOPIC =
        0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67;

    struct Pool {
        address token0;
        address token1;
        bool registered;
    }

    /// @notice Token pair per pool, per chain.
    mapping(uint64 chainKey => mapping(address pool => Pool)) public pools;

    event PoolRegistered(uint64 indexed chainKey, address indexed pool, address token0, address token1);

    error InvalidPool();

    constructor(address owner_) Ownable(owner_) {}

    /// @notice Register a v3 pool's token pair.
    /// @dev token0 and token1 must be recorded exactly as the pool reports them, which for a v3
    /// pool is ascending address order.
    function registerPool(uint64 chainKey, address pool, address token0, address token1)
        external
        onlyOwner
    {
        if (pool == address(0) || token0 == address(0) || token1 == address(0)) revert InvalidPool();
        pools[chainKey][pool] = Pool({token0: token0, token1: token1, registered: true});
        emit PoolRegistered(chainKey, pool, token0, token1);
    }

    function decode(uint64 chainKey, EvmV1Decoder.LogEntry memory logEntry)
        external
        view
        returns (bool, uint8, address, address, uint256, uint256)
    {
        if (logEntry.topics[0] != TOPIC) return (false, 0, address(0), address(0), 0, 0);
        // sender and recipient indexed, five words of data.
        if (logEntry.topics.length != 3 || logEntry.data.length < 160) {
            return (false, 0, address(0), address(0), 0, 0);
        }

        Pool memory pool = pools[chainKey][logEntry.address_];
        // An unregistered pool means we cannot say which token an amount refers to, so the log is
        // not decodable even though its shape is right.
        if (!pool.registered) return (false, 0, address(0), address(0), 0, 0);

        // topics[2] is `recipient`, who receives the output. topics[1] is `sender`, which behind a
        // router is the router itself, not the player.
        address player = address(uint160(uint256(logEntry.topics[2])));

        (int256 amount0, int256 amount1) = abi.decode(logEntry.data, (int256, int256));

        address token;
        uint256 amount;
        if (amount0 > 0) {
            token = pool.token0;
            amount = uint256(amount0);
        } else if (amount1 > 0) {
            token = pool.token1;
            amount = uint256(amount1);
        } else {
            // Neither side positive means no input was taken. Not a swap we can price.
            return (false, 0, address(0), address(0), 0, 0);
        }

        return (true, uint8(VaelTypes.ActionType.UniswapSwap), player, token, amount, 0);
    }
}
