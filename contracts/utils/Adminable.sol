// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.20;

// import "hardhat/console.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {AdminRegistry} from "../subscriptions/AdminRegistry.sol";
import {SubscriberChecks} from "../subscriptions/SubscriberChecks.sol";
import {IStorage} from "../interfaces/IStorage.sol";

/**
 * @title Adminable;
 * @author @Pedrojok01
 * @notice Part of the Loyalty Platform
 * @dev Contract module which provides an access control mechanism for
 * either the owner or the admin.
 *
 * Work alongside the AdminRegistry contract to manage the admin status.
 */

contract Adminable is Ownable, SubscriberChecks {
  AdminRegistry private _adminRegistry;

  constructor(
    // solhint-disable-next-line no-unused-vars
    address owner_,
    address _storageAddress
  ) SubscriberChecks(IStorage(_storageAddress).getSubscriptionControl()) Ownable(owner_) {
    address adminRegistry_ = IStorage(_storageAddress).getAdminRegistry();

    if (adminRegistry_ == address(0)) {
      revert Adminable__AddressZero();
    }

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
    // Ensure the owner is registered (Owns a membership)
    bool exists = _adminRegistry.isExistingUser(owner());
    if (!exists) {
      revert Adminable__UserNotRegistered();
    }

    if (_isSenderAdmin()) {
      // Ensure the owner not opted out of adminship
      bool optedOut = _adminRegistry.isUserOptedOut(owner());
      if (optedOut) {
        revert Adminable__UserOptedOut();
      }
      // Ensure the owner is a subscriber
      _onlySubscribers(owner());
    }
  }

  function _isSenderOwner() private view returns (bool) {
    // solhint-disable-next-line avoid-tx-origin
    return _msgSender() == owner() || tx.origin == owner();
  }

  function _isSenderAdmin() private view returns (bool) {
    // solhint-disable-next-line avoid-tx-origin
    return _msgSender() == _adminRegistry.admin() || tx.origin == _adminRegistry.admin();
  }
}
