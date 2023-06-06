// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.19;

// import "hardhat/console.sol";
import {Errors} from "../utils/Errors.sol";

/**
 * @title Activation
 * @author Pierre Estrabaud (@Pedrojok01)
 * @notice Part of the Meed Loyalty Platform from SuperUltra
 * @dev Provides a simple way to activate/desactivate a promotion;
 */

contract Activation is Errors {
  bool private active = true;

  /**
   * @dev Events emitted when a promotion is activated/deactivated by `account`.
   */
  event Activated(address account, address promoAddress);
  event Deactivated(address account, address promoAddress);

  modifier onlyActive() {
    _requireActivated();
    _;
  }

  modifier onlyInactive() {
    _requireDeactivated();
    _;
  }

  /**
   * @dev Returns true if the promotion is active, and false otherwise.
   */
  function isActive() public view returns (bool) {
    return active;
  }

  /**
   * @dev Allows the current owner or admin to activate the promotion.
   */
  function _activate(address promoAddress) internal onlyInactive {
    active = true;
    emit Activated(tx.origin, promoAddress);
  }

  /**
   * @dev Allows the current owner or admin to deactivate the promotion.
   */
  function _deactivate(address promoAddress) internal onlyActive {
    active = false;
    emit Deactivated(tx.origin, promoAddress);
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
