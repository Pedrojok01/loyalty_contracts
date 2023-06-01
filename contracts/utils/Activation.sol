// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.18;

import {Errors} from "../utils/Errors.sol";

/**
 * @title Activation
 * @author Pierre Estrabaud (@Pedrojok01)
 * @notice Part of the Meed Loyalty Platform from SuperUltra
 * @dev Provides a simple way to activate/desactivate a promotion;
 */

contract Activation is Errors {
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
  function _activate() internal onlyInactive {
    active = true;
    emit Activated(msg.sender);
  }

  /**
   * @dev Emitted when the pause is triggered by `account`.
   */
  event Activated(address account);

  /**
   * @dev Allows the current owner or admin to deactivate the promotion.
   */
  function _deactivate() internal onlyActive {
    active = false;
    emit Deactivated(msg.sender);
  }

  /**
   * @dev Emitted when the pause is lifted by `account`.
   */
  event Deactivated(address account);

  /**
   * @dev Returns true if the promotion is active, and false otherwise.
   */
  function isActive() public view returns (bool) {
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
