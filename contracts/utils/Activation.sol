// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.18;

import {Adminable} from "../utils/Adminable.sol";

/**
 * @title Activation
 * @author Pierre Estrabaud (@Pedrojok01)
 * @notice Part of the Loyal-T platform from SuperUltra
 * @dev Provides a simple way to activate/desactivate a promotion;
 */

contract Activation is Adminable {
    bool private active = true;

    modifier onlyActive() {
        _requireActivated();
        _;
    }

    modifier onlyInactive() {
        _requireDeactivated();
        _;
    }

    /**
     * @dev Allows the current owner or admin to activate the promotion.
     */
    function activate() external onlyInactive onlyOwnerOrAdmin {
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
    function deactivate() external onlyActive onlyOwnerOrAdmin {
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
}
