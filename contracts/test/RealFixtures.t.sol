// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {EvmV1Decoder} from "@gluwa/asc-contracts/contracts/common/EvmV1Decoder.sol";

import {PortalAdapter} from "../src/adapters/PortalAdapter.sol";
import {Erc20TransferAdapter} from "../src/adapters/Erc20TransferAdapter.sol";
import {UniswapV3SwapAdapter} from "../src/adapters/UniswapV3SwapAdapter.sol";
import {AaveV3Adapter} from "../src/adapters/AaveV3Adapter.sol";
import {IActionAdapter} from "../src/interfaces/IActionAdapter.sol";
import {VaelTypes} from "../src/interfaces/IVaelTypes.sol";

/// @notice Replays real Sepolia transactions through the real adapters.
///
/// @dev The bytes in `test/fixtures/*.json` are exactly what the Attestcoin block prover delivered
/// for transactions that were mined on Sepolia and verified on Creditcoin. Running the decoder over
/// them offline is the difference between "the adapter handles the shape I imagined" and "the
/// adapter handles what the network actually produced": real receipts carry extra logs, unusual
/// orderings, and amounts that a hand-written fixture would never think to include.
///
/// The fixtures are captured by `apps/api/scripts/e2e-actions.ts` during a live run.
contract RealFixturesTest is Test {
    uint64 internal constant SEPOLIA = 1;

    PortalAdapter internal portalAdapter;
    Erc20TransferAdapter internal erc20Adapter;
    UniswapV3SwapAdapter internal uniAdapter;
    AaveV3Adapter internal aaveAdapter;

    function setUp() public {
        portalAdapter = new PortalAdapter();
        erc20Adapter = new Erc20TransferAdapter();
        uniAdapter = new UniswapV3SwapAdapter(address(this));
        aaveAdapter = new AaveV3Adapter();
    }

    struct Fixture {
        bytes encodedTransaction;
        address emitter;
        address player;
        address token;
        uint256 amount;
        uint8 actionType;
    }

    function _load(string memory name) internal view returns (Fixture memory fixture) {
        string memory path = string.concat(vm.projectRoot(), "/test/fixtures/", name, ".json");
        string memory json = vm.readFile(path);
        fixture.encodedTransaction = vm.parseJsonBytes(json, ".encodedTransaction");
        fixture.emitter = vm.parseJsonAddress(json, ".emitter");
        fixture.player = vm.parseJsonAddress(json, ".player");
        fixture.token = vm.parseJsonAddress(json, ".token");
        fixture.amount = vm.parseJsonUint(json, ".amount");
        fixture.actionType = uint8(vm.parseJsonUint(json, ".actionType"));
    }

    /// @dev Sweep the real receipt exactly as VaelAscBase does and return the log the adapter
    /// recognises from the expected emitter.
    function _decodeThrough(IActionAdapter adapter, Fixture memory fixture)
        internal
        view
        returns (bool found, address player, address token, uint256 amount, uint8 actionType)
    {
        EvmV1Decoder.ReceiptFields memory receipt =
            EvmV1Decoder.decodeReceiptFields(fixture.encodedTransaction);
        assertEq(receipt.receiptStatus, 1, "the captured source transaction must have succeeded");

        for (uint256 i = 0; i < receipt.receiptLogs.length; ++i) {
            EvmV1Decoder.LogEntry memory entry = receipt.receiptLogs[i];
            if (entry.topics.length == 0) continue;
            if (entry.address_ != fixture.emitter) continue;
            (bool ok, uint8 action, address who, address tok, uint256 amt,) =
                adapter.decode(SEPOLIA, entry);
            if (!ok) continue;
            return (true, who, tok, amt, action);
        }
        return (false, address(0), address(0), 0, 0);
    }

    function _assertFixture(IActionAdapter adapter, string memory name) internal view {
        Fixture memory fixture = _load(name);
        (bool found, address player, address token, uint256 amount, uint8 actionType) =
            _decodeThrough(adapter, fixture);

        assertTrue(found, string.concat(name, ": adapter did not recognise the real log"));
        assertEq(player, fixture.player, string.concat(name, ": player"));
        assertEq(token, fixture.token, string.concat(name, ": token"));
        assertEq(actionType, fixture.actionType, string.concat(name, ": actionType"));
        assertGe(amount, 1, string.concat(name, ": amount must be positive"));
    }

    function test_RealErc20Transfer() public view {
        _assertFixture(erc20Adapter, "erc20-transfer");
        Fixture memory fixture = _load("erc20-transfer");
        (,,, uint256 amount,) = _decodeThrough(erc20Adapter, fixture);
        assertEq(amount, fixture.amount, "the decoded amount must be the transferred amount");
    }

    function test_RealUniswapSwap() public {
        Fixture memory fixture = _load("uniswap-swap");
        // Register the real pool's real token pair, read from the pool on Sepolia at capture time.
        uniAdapter.registerPool(
            SEPOLIA,
            fixture.emitter,
            0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238, // USDC, token0
            0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14 // WETH9, token1
        );
        _assertFixture(uniAdapter, "uniswap-swap");

        (,,, uint256 amount,) = _decodeThrough(uniAdapter, fixture);
        assertEq(amount, fixture.amount, "the input side of the swap, not the output");
    }

    function test_RealAaveSupply() public view {
        _assertFixture(aaveAdapter, "aave-supply");
        Fixture memory fixture = _load("aave-supply");
        (,,, uint256 amount, uint8 actionType) = _decodeThrough(aaveAdapter, fixture);
        assertEq(actionType, uint8(VaelTypes.ActionType.AaveSupply));
        assertEq(amount, fixture.amount);
    }

    function test_RealAaveBorrow() public view {
        _assertFixture(aaveAdapter, "aave-borrow");
        Fixture memory fixture = _load("aave-borrow");
        (, address player,, uint256 amount, uint8 actionType) =
            _decodeThrough(aaveAdapter, fixture);

        assertEq(actionType, uint8(VaelTypes.ActionType.AaveBorrow));
        assertEq(amount, fixture.amount);
        // Borrow and Supply share an adapter and an indexed layout, so the one thing worth
        // asserting separately is that a real Borrow is not mistaken for a Supply.
        assertTrue(actionType != uint8(VaelTypes.ActionType.AaveSupply));
        assertEq(player, fixture.player);
    }

    /// @dev The Aave Pool emits both events. Each must decode as itself and only itself, or a
    /// borrow quest could be satisfied by a supply, which is a strictly easier action.
    function test_RealAaveSupplyAndBorrowAreNotInterchangeable() public view {
        Fixture memory supply = _load("aave-supply");
        Fixture memory borrow = _load("aave-borrow");
        (,,,, uint8 supplyAction) = _decodeThrough(aaveAdapter, supply);
        (,,,, uint8 borrowAction) = _decodeThrough(aaveAdapter, borrow);

        assertEq(supplyAction, uint8(VaelTypes.ActionType.AaveSupply));
        assertEq(borrowAction, uint8(VaelTypes.ActionType.AaveBorrow));
        assertTrue(supplyAction != borrowAction);
    }

    /// @dev A real swap receipt carries ERC-20 Transfers beside the Swap. Each adapter must pick
    /// out only its own, which is what makes the declining handler in VaelAscBase work.
    function test_RealSwapReceiptAlsoCarriesTransfers() public view {
        Fixture memory fixture = _load("uniswap-swap");
        EvmV1Decoder.ReceiptFields memory receipt =
            EvmV1Decoder.decodeReceiptFields(fixture.encodedTransaction);

        uint256 transfers;
        uint256 swaps;
        for (uint256 i = 0; i < receipt.receiptLogs.length; ++i) {
            EvmV1Decoder.LogEntry memory entry = receipt.receiptLogs[i];
            if (entry.topics.length == 0) continue;
            (bool isTransfer,,,,,) = erc20Adapter.decode(SEPOLIA, entry);
            if (isTransfer) transfers++;
            if (entry.topics[0] == uniAdapter.TOPIC()) swaps++;
        }
        assertGe(transfers, 1, "a real swap moves tokens, so it emits Transfers");
        assertEq(swaps, 1, "exactly one Swap in the receipt");
    }
}
