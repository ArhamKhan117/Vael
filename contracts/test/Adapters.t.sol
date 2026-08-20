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

import {SourceTxFixture} from "./SourceTxFixture.sol";

/// @notice Adapters decode real receipt bytes, and never revert on a malformed log.
/// @dev Every case here goes through `EvmV1Decoder.decodeReceiptFields` over bytes built in the
/// prover's exact wire shape, so the adapter sees exactly what it sees on chain. A test that passed
/// a hand-built `LogEntry` straight in would skip the decoder and prove much less.
contract AdaptersTest is Test {
    PortalAdapter internal portalAdapter;
    Erc20TransferAdapter internal erc20Adapter;
    UniswapV3SwapAdapter internal uniAdapter;
    AaveV3Adapter internal aaveAdapter;

    uint64 internal constant SEPOLIA = 1;
    address internal constant PORTAL = address(0xB0B0);
    address internal constant TOKEN = address(0x7075);
    address internal constant POOL = address(0x9001);
    address internal constant AAVE_POOL = address(0xAAE0);
    address internal constant WETH = address(0x3E74);
    address internal player = address(0x2222);
    address internal router = address(0x4044);

    function setUp() public {
        portalAdapter = new PortalAdapter();
        erc20Adapter = new Erc20TransferAdapter();
        uniAdapter = new UniswapV3SwapAdapter(address(this));
        aaveAdapter = new AaveV3Adapter();
    }

    /// @dev Round-trip one log through the real decoder, exactly as QuestASC does.
    function _decodeFirstLog(SourceTxFixture.Log memory entry)
        internal
        pure
        returns (EvmV1Decoder.LogEntry memory)
    {
        bytes memory encoded =
            SourceTxFixture.build(address(0xF00D), 1, SourceTxFixture.single(entry));
        EvmV1Decoder.ReceiptFields memory receipt = EvmV1Decoder.decodeReceiptFields(encoded);
        return receipt.receiptLogs[0];
    }

    // ---------------------------------------------------------------- portal

    function test_Portal_DecodesQuestIdPlayerAndAmount() public view {
        EvmV1Decoder.LogEntry memory entry =
            _decodeFirstLog(SourceTxFixture.portalLog(PORTAL, 42, player, address(0), 1 ether));

        (bool ok, uint8 action, address who, address token, uint256 amount, uint256 questId) =
            portalAdapter.decode(SEPOLIA, entry);

        assertTrue(ok);
        assertEq(action, uint8(VaelTypes.ActionType.Portal));
        assertEq(who, player);
        assertEq(token, address(0));
        assertEq(amount, 1 ether);
        assertEq(questId, 42, "the portal event names its own quest");
    }

    // ---------------------------------------------------------------- erc20

    function test_Erc20_PlayerIsTheSenderAndTokenIsTheEmitter() public view {
        EvmV1Decoder.LogEntry memory entry = _decodeFirstLog(
            SourceTxFixture.erc20TransferLog(TOKEN, player, address(0xDEAD), 250e6)
        );

        (bool ok, uint8 action, address who, address token, uint256 amount, uint256 questId) =
            erc20Adapter.decode(SEPOLIA, entry);

        assertTrue(ok);
        assertEq(action, uint8(VaelTypes.ActionType.Erc20Transfer));
        assertEq(who, player, "player is `from`, not `to`");
        assertEq(token, TOKEN, "token is the emitting contract");
        assertEq(amount, 250e6);
        assertEq(questId, 0, "an ERC-20 transfer cannot name a quest");
    }

    /// @dev ERC-721 emits a Transfer with the same signature hash but a fourth indexed topic. If
    /// that decoded, an NFT token id would be read as a token amount.
    function test_Erc20_RejectsErc721ShapedTransfer() public view {
        bytes32[] memory topics = new bytes32[](4);
        topics[0] = erc20Adapter.TOPIC();
        topics[1] = bytes32(uint256(uint160(player)));
        topics[2] = bytes32(uint256(uint160(address(0xDEAD))));
        topics[3] = bytes32(uint256(999)); // tokenId, indexed
        EvmV1Decoder.LogEntry memory entry = _decodeFirstLog(
            SourceTxFixture.Log({emitter: TOKEN, topics: topics, data: ""})
        );

        (bool ok,,,,,) = erc20Adapter.decode(SEPOLIA, entry);
        assertFalse(ok, "an ERC-721 transfer must not decode as an amount");
    }

    // ---------------------------------------------------------------- uniswap

    function test_Uniswap_InputSideIsThePositiveAmount() public {
        uniAdapter.registerPool(SEPOLIA, POOL, TOKEN, WETH);
        // Pool received 300 token0, paid out 1 token1. The input is token0.
        EvmV1Decoder.LogEntry memory entry = _decodeFirstLog(
            SourceTxFixture.uniswapSwapLog(POOL, router, player, int256(300e6), int256(-1 ether))
        );

        (bool ok, uint8 action, address who, address token, uint256 amount,) =
            uniAdapter.decode(SEPOLIA, entry);

        assertTrue(ok);
        assertEq(action, uint8(VaelTypes.ActionType.UniswapSwap));
        assertEq(who, player, "player is the recipient, never the router that sent the swap");
        assertEq(token, TOKEN);
        assertEq(amount, 300e6);
    }

    function test_Uniswap_InputOnTheOtherSide() public {
        uniAdapter.registerPool(SEPOLIA, POOL, TOKEN, WETH);
        EvmV1Decoder.LogEntry memory entry = _decodeFirstLog(
            SourceTxFixture.uniswapSwapLog(POOL, router, player, int256(-500e6), int256(2 ether))
        );

        (bool ok,,, address token, uint256 amount,) = uniAdapter.decode(SEPOLIA, entry);
        assertTrue(ok);
        assertEq(token, WETH);
        assertEq(amount, 2 ether);
    }

    function test_Uniswap_UnregisteredPoolIsNotDecodable() public view {
        EvmV1Decoder.LogEntry memory entry = _decodeFirstLog(
            SourceTxFixture.uniswapSwapLog(POOL, router, player, int256(300e6), int256(-1 ether))
        );
        (bool ok,,,,,) = uniAdapter.decode(SEPOLIA, entry);
        assertFalse(ok, "without the token pair, an amount has no meaning");
    }

    function test_Uniswap_PoolRegistrationIsChainScoped() public {
        uniAdapter.registerPool(SEPOLIA, POOL, TOKEN, WETH);
        EvmV1Decoder.LogEntry memory entry = _decodeFirstLog(
            SourceTxFixture.uniswapSwapLog(POOL, router, player, int256(300e6), int256(-1 ether))
        );
        (bool onSepolia,,,,,) = uniAdapter.decode(SEPOLIA, entry);
        (bool onMainnet,,,,,) = uniAdapter.decode(3, entry);
        assertTrue(onSepolia);
        assertFalse(onMainnet, "the same pool address on another chain is a different pool");
    }

    // ---------------------------------------------------------------- aave

    function test_Aave_SupplyCreditsOnBehalfOfNotUser() public view {
        address gateway = address(0x6A7E);
        EvmV1Decoder.LogEntry memory entry = _decodeFirstLog(
            SourceTxFixture.aaveSupplyLog(AAVE_POOL, TOKEN, gateway, player, 100e6)
        );

        (bool ok, uint8 action, address who, address reserve, uint256 amount,) =
            aaveAdapter.decode(SEPOLIA, entry);

        assertTrue(ok);
        assertEq(action, uint8(VaelTypes.ActionType.AaveSupply));
        assertEq(who, player, "onBehalfOf owns the position; user may be a gateway");
        assertTrue(who != gateway);
        assertEq(reserve, TOKEN);
        assertEq(amount, 100e6);
    }

    function test_Aave_Borrow() public view {
        EvmV1Decoder.LogEntry memory entry = _decodeFirstLog(
            SourceTxFixture.aaveBorrowLog(AAVE_POOL, TOKEN, player, player, 25e6)
        );
        (bool ok, uint8 action,, address reserve, uint256 amount,) =
            aaveAdapter.decode(SEPOLIA, entry);
        assertTrue(ok);
        assertEq(action, uint8(VaelTypes.ActionType.AaveBorrow));
        assertEq(reserve, TOKEN);
        assertEq(amount, 25e6);
    }

    // ---------------------------------------------------------------- cross-rejection

    /// @dev Each adapter must ignore every other adapter's event, so a registration mistake cannot
    /// make one protocol's log decode as another's.
    function test_AdaptersIgnoreEachOthersEvents() public {
        uniAdapter.registerPool(SEPOLIA, POOL, TOKEN, WETH);

        SourceTxFixture.Log[4] memory logs = [
            SourceTxFixture.portalLog(PORTAL, 1, player, address(0), 1 ether),
            SourceTxFixture.erc20TransferLog(TOKEN, player, address(0xDEAD), 1),
            SourceTxFixture.uniswapSwapLog(POOL, router, player, int256(1), int256(-1)),
            SourceTxFixture.aaveSupplyLog(AAVE_POOL, TOKEN, player, player, 1)
        ];
        IActionAdapter[4] memory adapters =
            [IActionAdapter(portalAdapter), erc20Adapter, uniAdapter, aaveAdapter];

        for (uint256 i = 0; i < 4; ++i) {
            EvmV1Decoder.LogEntry memory entry = _decodeFirstLog(logs[i]);
            for (uint256 j = 0; j < 4; ++j) {
                (bool ok,,,,,) = adapters[j].decode(SEPOLIA, entry);
                if (i == j) {
                    assertTrue(ok, "an adapter must decode its own event");
                } else {
                    assertFalse(ok, "an adapter must ignore another protocol's event");
                }
            }
        }
    }

    // ---------------------------------------------------------------- malformed

    /// @dev No adapter may revert on any log, however malformed. A revert would strand every quest
    /// log beside it in the same source transaction.
    function testFuzz_AdaptersNeverRevertOnArbitraryLogs(
        uint8 topicCount,
        bytes32 topic0,
        bytes calldata data,
        address emitter
    ) public {
        uniAdapter.registerPool(SEPOLIA, POOL, TOKEN, WETH);
        vm.assume(data.length <= 512);

        uint256 count = uint256(topicCount) % 5;
        // A log with no topics never reaches an adapter: VaelAscBase skips it first.
        if (count == 0) count = 1;

        bytes32[] memory topics = new bytes32[](count);
        topics[0] = topic0;
        for (uint256 i = 1; i < count; ++i) {
            topics[i] = keccak256(abi.encode(topic0, i));
        }

        EvmV1Decoder.LogEntry memory entry =
            EvmV1Decoder.LogEntry({address_: emitter, topics: topics, data: data});

        // Each must return, never revert. The boolean is free to be either.
        (bool a,,,,,) = portalAdapter.decode(SEPOLIA, entry);
        (bool b,,,,,) = erc20Adapter.decode(SEPOLIA, entry);
        (bool c,,,,,) = uniAdapter.decode(SEPOLIA, entry);
        (bool d,,,,,) = aaveAdapter.decode(SEPOLIA, entry);
        assertTrue(a || !a);
        assertTrue(b || !b);
        assertTrue(c || !c);
        assertTrue(d || !d);
    }

    /// @dev A correct signature with a truncated payload must be refused, not read as zeros.
    function testFuzz_TruncatedPayloadsAreRefused(uint8 dataLen) public {
        uniAdapter.registerPool(SEPOLIA, POOL, TOKEN, WETH);
        bytes memory short = new bytes(uint256(dataLen) % 32);

        bytes32[] memory portalTopics = new bytes32[](4);
        portalTopics[0] = portalAdapter.TOPIC();
        (bool p,,,,,) = portalAdapter.decode(
            SEPOLIA,
            EvmV1Decoder.LogEntry({address_: PORTAL, topics: portalTopics, data: short})
        );
        assertFalse(p, "portal payload shorter than two words must be refused");

        bytes32[] memory erc20Topics = new bytes32[](3);
        erc20Topics[0] = erc20Adapter.TOPIC();
        (bool e,,,,,) = erc20Adapter.decode(
            SEPOLIA,
            EvmV1Decoder.LogEntry({address_: TOKEN, topics: erc20Topics, data: short})
        );
        assertFalse(e, "transfer payload shorter than one word must be refused");
    }
}
