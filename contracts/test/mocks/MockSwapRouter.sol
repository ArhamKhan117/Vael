// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @notice Stands in for PenguinSwap's SwapRouter in tests.
 *
 * @dev It behaves like the real one in the ways NativePortal depends on: it pulls `amountIn` from
 * the caller, pays `recipient` in `tokenOut`, honours `amountOutMinimum`, and returns what it paid.
 * The rate is settable so a test can make a swap return too little on purpose, and `setRevert` makes
 * it fail so a test can prove nothing completes when the swap does not.
 */
contract MockSwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    /// @dev Output per unit of input, in basis points. 10_000 is one for one.
    uint256 public rateBps = 10_000;
    bool public shouldRevert;

    error MockSwapRouter__Reverted();
    error MockSwapRouter__TooLittleOut(uint256 minimum, uint256 got);
    error MockSwapRouter__DeadlinePassed();

    function setRate(uint256 bps) external {
        rateBps = bps;
    }

    function setRevert(bool value) external {
        shouldRevert = value;
    }

    function exactInputSingle(ExactInputSingleParams calldata params)
        external
        payable
        returns (uint256 amountOut)
    {
        if (shouldRevert) revert MockSwapRouter__Reverted();
        if (block.timestamp > params.deadline) revert MockSwapRouter__DeadlinePassed();

        IERC20(params.tokenIn).transferFrom(msg.sender, address(this), params.amountIn);
        amountOut = (params.amountIn * rateBps) / 10_000;
        if (amountOut < params.amountOutMinimum) {
            revert MockSwapRouter__TooLittleOut(params.amountOutMinimum, amountOut);
        }
        IERC20(params.tokenOut).transfer(params.recipient, amountOut);
    }
}
