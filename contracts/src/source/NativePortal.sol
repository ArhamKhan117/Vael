// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {ICompletionHook} from "../interfaces/ICompletionHook.sol";
import {IQuestManager} from "../interfaces/IQuestManager.sol";
import {VaelTypes} from "../interfaces/IVaelTypes.sol";

interface IQuestManagerNative is IQuestManager {
    function nativeRule(uint256 questId) external view returns (VaelTypes.VerificationRule memory);
    function hasAccepted(uint256 questId, address participant) external view returns (bool);
    function recordCompletion(
        uint256 questId,
        address participant,
        bytes32 replayKey,
        bytes32 sourceTxHash
    ) external;
}

interface ISwapRouter {
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

    function exactInputSingle(ExactInputSingleParams calldata params)
        external
        payable
        returns (uint256 amountOut);
}

interface IWrappedNative {
    function deposit() external payable;
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address owner) external view returns (uint256);
}

/**
 * @title NativePortal
 * @notice The second way a Vael quest can complete: by this contract doing the thing itself.
 *
 * @dev **Why this exists, stated plainly.** Attestcoin attests other chains to Creditcoin. It does
 * not attest Creditcoin to itself, so a PenguinSwap swap on Creditcoin has no proof to carry and
 * `QuestASC` can never verify one. Vael refuses to add a trusted oracle that would simply be told a
 * swap happened, because that key is the whole thing the project exists to remove.
 *
 * The honest alternative is synchronous execution. This contract does not hear about a swap; it
 * performs the swap. It pulls the player's tokens, calls PenguinSwap's router, reads the amount the
 * router returned, checks it against the quest's own rule, and records the completion in the same
 * transaction. If the swap reverts, nothing completes. If the swap returns less than the rule
 * demands, nothing completes. There is no moment at which anything takes somebody's word for it,
 * and no key that can pay a player without a swap actually having happened.
 *
 * That is a weaker claim than an Attestcoin proof and it is a different claim, not a lesser version
 * of the same one. An Attestcoin quest proves a transaction that happened elsewhere, without
 * trusting the reporter. A native quest is the transaction. Both are keyless; only one is
 * cross-chain. `docs/ATTESTCOIN_INTEGRATION.md` section 9 says so at length, and the UI labels
 * native quests rather than letting them pass as proved.
 *
 * `QuestManager.recordCompletion` accepts this contract only for quests whose rule named a native
 * action at creation, so this cannot complete a quest that was meant to be proved.
 */
contract NativePortal is Ownable {
    using SafeERC20 for IERC20;

    /// @notice Gas each completion hook may spend, matching QuestASC so both paths behave alike.
    uint256 public constant HOOK_GAS_LIMIT = 400_000;

    /// @notice Multiples of the rule's minimum that earn tier 2 and tier 3, as in QuestASC.
    uint256 public constant TIER_2_MULTIPLE = 5;
    uint256 public constant TIER_3_MULTIPLE = 25;

    /// @notice Seconds a swap may sit in the mempool before the router refuses it.
    uint256 public constant SWAP_DEADLINE_WINDOW = 10 minutes;

    IQuestManagerNative public immutable QUEST_MANAGER;

    /// @notice PenguinSwap's router.
    /// @dev Settable rather than immutable: it is a third party's address, discovered on chain
    /// rather than published, and being wrong about it should cost one transaction.
    address public swapRouter;

    /// @notice Wrapped CTC, PenguinSwap's WETH9 equivalent.
    address public wrappedNative;

    /// @notice Hooks notified after a native completion, in order. Same contracts as QuestASC's.
    ICompletionHook[] public hooks;

    event SwapRouterUpdated(address indexed router);
    event WrappedNativeUpdated(address indexed wrapped);
    event HookAdded(address indexed hook, uint256 index);
    event HookRemoved(address indexed hook, uint256 index);
    event HookFailed(uint256 indexed questId, address indexed hook, bytes reason);

    /// @dev The native counterpart of `QuestProofApplied`. Deliberately a different event name:
    /// nothing was proved here, and an indexer should not be able to confuse the two.
    event NativeActionApplied(
        uint256 indexed questId,
        address indexed player,
        uint8 indexed actionType,
        address tokenIn,
        uint256 amountIn,
        address tokenOut,
        uint256 amountOut
    );

    error NativePortal__ZeroAddress();
    error NativePortal__RouterNotSet();
    error NativePortal__NotNativeQuest(uint256 questId);
    error NativePortal__WrongAction(uint8 expected, uint8 got);
    error NativePortal__QuestNotActive(uint256 questId);
    error NativePortal__QuestExpired(uint256 questId);
    error NativePortal__NotTheParticipant(address expected, address caller);
    error NativePortal__NotAccepted(uint256 questId, address participant);
    error NativePortal__WrongToken(address expected, address got);
    error NativePortal__AmountBelowMinimum(uint256 minimum, uint256 got);
    error NativePortal__HookAlreadyRegistered(address hook);
    error NativePortal__HookIndexOutOfRange(uint256 index);

    constructor(address owner_, address questManager) Ownable(owner_) {
        if (questManager == address(0)) revert NativePortal__ZeroAddress();
        QUEST_MANAGER = IQuestManagerNative(questManager);
    }

    // ---------------------------------------------------------------- admin

    function setSwapRouter(address router) external onlyOwner {
        if (router == address(0)) revert NativePortal__ZeroAddress();
        swapRouter = router;
        emit SwapRouterUpdated(router);
    }

    function setWrappedNative(address wrapped) external onlyOwner {
        if (wrapped == address(0)) revert NativePortal__ZeroAddress();
        wrappedNative = wrapped;
        emit WrappedNativeUpdated(wrapped);
    }

    /// @notice Append a completion hook. Order matters: VaelHero before RaidBoss, as in QuestASC.
    function addHook(ICompletionHook hook) external onlyOwner {
        if (address(hook) == address(0)) revert NativePortal__ZeroAddress();
        uint256 count = hooks.length;
        for (uint256 i = 0; i < count; ++i) {
            if (address(hooks[i]) == address(hook)) revert NativePortal__HookAlreadyRegistered(address(hook));
        }
        hooks.push(hook);
        emit HookAdded(address(hook), count);
    }

    function removeHook(uint256 index) external onlyOwner {
        uint256 count = hooks.length;
        if (index >= count) revert NativePortal__HookIndexOutOfRange(index);
        address removed = address(hooks[index]);
        for (uint256 i = index; i + 1 < count; ++i) {
            hooks[i] = hooks[i + 1];
        }
        hooks.pop();
        emit HookRemoved(removed, index);
    }

    function hookCount() external view returns (uint256) {
        return hooks.length;
    }

    // ---------------------------------------------------------------- actions

    /**
     * @notice Swap on PenguinSwap and complete the quest, in one transaction.
     * @param questId The quest, whose rule says what counts.
     * @param tokenIn Token the player is selling. Must match the rule when the rule names one.
     * @param tokenOut Token the player is buying.
     * @param fee The PenguinSwap pool fee tier, in hundredths of a basis point.
     * @param amountIn Amount to sell, pulled from the caller.
     * @param minOut Slippage floor the player sets. Independent of the quest's own minimum.
     *
     * @dev The caller is the player. Nobody can perform this on somebody else's behalf, because the
     * tokens come out of `msg.sender` and the quest is checked against `msg.sender`.
     */
    function swapViaPenguinSwap(
        uint256 questId,
        address tokenIn,
        address tokenOut,
        uint24 fee,
        uint256 amountIn,
        uint256 minOut
    ) external returns (uint256 amountOut) {
        if (swapRouter == address(0)) revert NativePortal__RouterNotSet();
        VaelTypes.VerificationRule memory rule =
            _checkedRule(questId, uint8(VaelTypes.ActionType.PenguinSwapSwap));

        // The rule's token, when it names one, is the token the player must be selling.
        if (rule.token != address(0) && rule.token != tokenIn) {
            revert NativePortal__WrongToken(rule.token, tokenIn);
        }
        if (amountIn < rule.minAmount) revert NativePortal__AmountBelowMinimum(rule.minAmount, amountIn);

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenIn).forceApprove(swapRouter, amountIn);

        // The router pays the player directly. Nothing that came out of the swap is ever held here.
        amountOut = ISwapRouter(swapRouter).exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                fee: fee,
                recipient: msg.sender,
                deadline: block.timestamp + SWAP_DEADLINE_WINDOW,
                amountIn: amountIn,
                amountOutMinimum: minOut,
                sqrtPriceLimitX96: 0
            })
        );

        // The approval is cleared whatever happened, so a router that spent less than it was
        // allowed cannot keep the remainder.
        IERC20(tokenIn).forceApprove(swapRouter, 0);

        _complete(questId, uint8(VaelTypes.ActionType.PenguinSwapSwap), tokenIn, amountIn, rule.minAmount);
        emit NativeActionApplied(
            questId, msg.sender, uint8(VaelTypes.ActionType.PenguinSwapSwap), tokenIn, amountIn, tokenOut, amountOut
        );
    }

    /**
     * @notice Wrap CTC into WCTC and complete the quest, in one transaction.
     * @dev The first thing a player needs before their first PenguinSwap trade, and the smallest
     * possible native action: the amount is what they sent, and the wrapped token goes to them.
     */
    function wrapNative(uint256 questId) external payable returns (uint256 wrapped) {
        address weth = wrappedNative;
        if (weth == address(0)) revert NativePortal__ZeroAddress();
        VaelTypes.VerificationRule memory rule =
            _checkedRule(questId, uint8(VaelTypes.ActionType.WrapNative));

        if (msg.value < rule.minAmount) revert NativePortal__AmountBelowMinimum(rule.minAmount, msg.value);

        IWrappedNative(weth).deposit{value: msg.value}();
        wrapped = msg.value;
        IWrappedNative(weth).transfer(msg.sender, wrapped);

        _complete(questId, uint8(VaelTypes.ActionType.WrapNative), address(0), msg.value, rule.minAmount);
        emit NativeActionApplied(
            questId, msg.sender, uint8(VaelTypes.ActionType.WrapNative), address(0), msg.value, weth, wrapped
        );
    }

    // ---------------------------------------------------------------- internals

    /// @dev Everything about the quest that must hold before the action is worth performing.
    function _checkedRule(uint256 questId, uint8 expectedAction)
        private
        view
        returns (VaelTypes.VerificationRule memory rule)
    {
        rule = QUEST_MANAGER.nativeRule(questId);
        if (uint8(rule.actionType) < VaelTypes.FIRST_NATIVE_ACTION) revert NativePortal__NotNativeQuest(questId);
        if (uint8(rule.actionType) != expectedAction) {
            revert NativePortal__WrongAction(expectedAction, uint8(rule.actionType));
        }

        IQuestManager.QuestVerificationContext memory context = QUEST_MANAGER.verificationContext(questId);
        if (!context.exists || !context.active) revert NativePortal__QuestNotActive(questId);
        if (context.expiry != 0 && block.timestamp > context.expiry) revert NativePortal__QuestExpired(questId);
        if (context.assignedParticipant != msg.sender) {
            revert NativePortal__NotTheParticipant(context.assignedParticipant, msg.sender);
        }
        if (!QUEST_MANAGER.hasAccepted(questId, msg.sender)) {
            revert NativePortal__NotAccepted(questId, msg.sender);
        }
    }

    /// @dev Record the completion, then notify the hooks exactly as QuestASC does.
    function _complete(uint256 questId, uint8 actionType, address token, uint256 amount, uint256 minAmount)
        private
    {
        // A native action's identity is its own transaction: there is no source chain and no log
        // ordinal, so the key is this chain, this block, this quest, this player. QuestManager
        // stores it as the completion's evidence, and it is as unforgeable as the transaction.
        bytes32 key = keccak256(abi.encode(block.chainid, block.number, questId, msg.sender));

        QUEST_MANAGER.recordCompletion(questId, msg.sender, key, key);
        _notifyHooks(questId, msg.sender, actionType, token, amount, minAmount, key);
    }

    /// @notice How far an action exceeded its rule's minimum: 1, 2 at 5x, 3 at 25x.
    function tierFor(uint256 amount, uint256 minAmount) public pure returns (uint8) {
        if (minAmount == 0) return 1;
        if (amount >= minAmount * TIER_3_MULTIPLE) return 3;
        if (amount >= minAmount * TIER_2_MULTIPLE) return 2;
        return 1;
    }

    /**
     * @dev Same contract as QuestASC's version, and deliberately so: a hook must not be able to
     * tell which path completed a quest by how it was called. The reward is already released by the
     * time this runs, and a hook that reverts or runs out of gas is recorded and skipped.
     *
     * `chainKey` is zero, which is what a native quest's source chain is: there is not one.
     * `sourceBlock` is Creditcoin's own block, which is the block the action happened in, so the
     * hero streak window measures the right thing for this path too.
     */
    function _notifyHooks(
        uint256 questId,
        address player,
        uint8 actionType,
        address token,
        uint256 amount,
        uint256 minAmount,
        bytes32 key
    ) private {
        uint8 tier = tierFor(amount, minAmount);
        uint64 sourceBlock = uint64(block.number);
        uint256 count = hooks.length;
        for (uint256 i = 0; i < count; ++i) {
            ICompletionHook hook = hooks[i];
            try hook.onQuestCompleted{gas: HOOK_GAS_LIMIT}(
                0, questId, player, actionType, token, amount, tier, sourceBlock, key
            ) {
                // Handled.
            } catch (bytes memory reason) {
                emit HookFailed(questId, address(hook), reason);
            }
        }
    }
}
