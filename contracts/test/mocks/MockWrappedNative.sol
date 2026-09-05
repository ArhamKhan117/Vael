// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice The smallest thing that behaves like WCTC: deposit mints one for one.
contract MockWrappedNative is ERC20 {
    constructor() ERC20("Wrapped CTC", "WCTC") {}

    function deposit() external payable {
        _mint(msg.sender, msg.value);
    }
}
