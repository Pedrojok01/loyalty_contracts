// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.18;

// import "hardhat/console.sol";
import {Context} from "@openzeppelin/contracts/utils/Context.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {AdminRegistry} from "../subscriptions/AdminRegistry.sol";
import {Errors} from "./Errors.sol";
import {SubscriberChecks} from "../subscriptions/SubscriberChecks.sol";

/**
 * @title Adminable;
 * @author Pierre Estrabaud (@Pedrojok01)
 * @notice Part of the Meed Loyalty Platform from SuperUltra
 * @dev Contract module which provides an access control mechanism for
 * either the owner or the admin.
 *
 * Work alongside the AdminRegistry contract to manage the admin status.
 */

contract Adminable is Ownable, SubscriberChecks {
  AdminRegistry private _adminRegistry;

  constructor(
    address adminRegistry_,
    address subscriptionsAddress_
  ) SubscriberChecks(subscriptionsAddress_) {
    require(adminRegistry_ != address(0), "Adminable: address zero");
    _adminRegistry = AdminRegistry(adminRegistry_);
  }

  modifier onlyOwnerOrAdmin() {
    _checkOwnerOrAdmin();
    _;
  }

  /**
   * @dev Returns the address of the current admin.
   */
  function admin() public view returns (address) {
    return _adminRegistry.admin();
  }

  /**
   * @dev Throws if the sender is not the owner or admin.
   */
  function _checkOwnerOrAdmin() private {
    // Ensure the sender is either owner or admin
    if (!_isSenderOwner() && !_isSenderAdmin()) {
      revert Adminable__NotAuthorized();
    }
    // Ensure the owner is registered and not opted out
    bool exists = _adminRegistry.isExistingUser(owner());
    if (!exists) {
      revert Adminable__UserNotRegistered();
    }

    if (_isSenderAdmin()) {
      // Ensure the owner not opted out
      bool optedOut = _adminRegistry.isUserOptedOut(owner());
      if (optedOut) {
        revert Adminable__UserOptedOut();
      }
      // Ensure the owner is a subscriber
      _onlySubscribers(owner());
    }
  }

  function _isSenderOwner() private view returns (bool) {
    return _msgSender() == owner() || tx.origin == owner();
  }

  function _isSenderAdmin() private view returns (bool) {
    return _msgSender() == _adminRegistry.admin() || tx.origin == _adminRegistry.admin();
  }
}
