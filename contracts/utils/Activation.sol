// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.18;

import "hardhat/console.sol";
import {Adminable} from "../utils/Adminable.sol";

/**
 * @title Activation
 * @author Pierre Estrabaud (@Pedrojok01)
 * @notice Part of the Meed Rewards platform from SuperUltra
 * @dev Provides a simple way to activate/desactivate a promotion;
 */

contract Activation is Adminable {
    address private immutable CONTRACT_ROLE;
    bool private active = true;

    modifier onlyActive() {
        _requireActivated();
        _;
    }

    modifier onlyInactive() {
        _requireDeactivated();
        _;
    }

    modifier onlyAuthorized() {
        _requireAuthorized();
        _;
    }

    constructor(address _contractRole) {
        CONTRACT_ROLE = _contractRole;
    }

    /**
     * @dev Allows the current owner or admin to activate the promotion.
     */
    function activate() external onlyInactive onlyAuthorized {
        active = true;
        emit Activated(_msgSender());
    }

    /**
     * @dev Emitted when the pause is triggered by `account`.
     */
    event Activated(address account);

    /**
     * @dev Allows the current owner or admin to deactivate the promotion.
     */
    function deactivate() external onlyActive onlyAuthorized {
        active = false;
        emit Deactivated(_msgSender());
    }

    /**
     * @dev Emitted when the pause is lifted by `account`.
     */
    event Deactivated(address account);

    /**
     * @dev Returns true if the promotion is active, and false otherwise.
     */
    function isActive() external view returns (bool) {
        return active;
    }

    /**
     * @dev Throws if the contract is paused.
     */
    function _requireActivated() private view {
        if (!active) revert Activation__PromotionCurrentlyInactive();
    }

    /**
     * @dev Throws if the contract is not paused.
     */
    function _requireDeactivated() private view {
        if (active) revert Activation__PromotionCurrentlyActive();
    }

    function _requireAuthorized() private view {
        if (owner() != _msgSender() && admin() != _msgSender() && CONTRACT_ROLE != _msgSender()) {
            revert Activation__NotAuthorized();
        }
    }
}
