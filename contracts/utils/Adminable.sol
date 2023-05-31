// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.18;

// import "hardhat/console.sol";
import {Context} from "@openzeppelin/contracts/utils/Context.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {AdminRegistry} from "../subscriptions/AdminRegistry.sol";
import {Errors} from "./Errors.sol";

/**
 * @title Adminable;
 * @author Pierre Estrabaud (@Pedrojok01)
 * @notice Part of the Meed Loyalty Platform from SuperUltra
 * @dev Contract module which provides an access control mechanism for
 * either the owner or the admin.
 *
 * Work alongside the AdminRegistry contract to manage the admin status.
 */

contract Adminable is Ownable, Errors {
  AdminRegistry private _adminRegistry;

  constructor(address adminRegistry_) {
    require(adminRegistry_ != address(0), "Adminable: address zero");
    _adminRegistry = AdminRegistry(adminRegistry_);
  }

  modifier onlyOwnerOrAdmin() {
    _checkOwnerOrAdmin();
    _;
  }

  modifier onlyAdmin() {
    _checkAdmin();
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
  function _checkOwnerOrAdmin() private view {
    bool exists = _adminRegistry.isExistingUser(owner());
    if (!exists) {
      revert Adminable__UserNotRegistered();
    }
    bool optedOut = _adminRegistry.isUserOptedOut(owner());
    if (optedOut) {
      revert Adminable__UserOptedOut();
    }
    if (owner() != _msgSender() && _adminRegistry.admin() != _msgSender()) {
      revert Adminable__NotAuthorized();
    }
  }

  /**
   * @dev Throws if the sender is not the admin.
   */
  function _checkAdmin() private view {
    if (_adminRegistry.admin() != _msgSender()) {
      revert Adminable__NotAuthorized();
    }
  }
}
