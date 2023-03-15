// SPDX-License-Identifier: BUSL-1.1
// Based on OpenZeppelin Contracts Ownable.sol
pragma solidity 0.8.18;

import {Context} from "@openzeppelin/contracts/utils/Context.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Errors} from "../utils/Errors.sol";

/**
 * @title Adminable;
 * @author @Pedrojok01
 * @notice Part of the Meed Rewards platform from SuperUltra
 * @dev Contract module which provides a basic access control mechanism, where
 * there is an account (an admin) that can be granted exclusive access to
 * specific functions.
 *
 * The admin account allows to perform action for the count of the admin,
 * removing all the fees and the wallet interactions. This admin account is
 * optional and can be removed by the admin at any time. By doing so, the admin
 * won't be able to enjoy our platform benefits anymore, and will have to manage
 * any loyaly program by himself.
 *
 * This module is used through inheritance. It will make available the modifier
 * `onlyAdmin`, which can be applied to your functions to restrict their use to
 * the admin.
 */
abstract contract Adminable is Context, Ownable, Errors {
    address private _admin;

    event AdminshipTransferred(address indexed previousAdmin, address indexed newAdmin);

    /**
     * @dev Initializes the contract setting the deployer as the initial admin.
     */
    constructor() {
        _transferAdminship(_msgSender());
    }

    modifier onlyOwnerOrAdmin() {
        _checkOwnerOrAdmin();
        _;
    }

    /**
     * @dev Returns the address of the current admin.
     */
    function admin() public view virtual returns (address) {
        return _admin;
    }

    /**
     * @dev Throws if the sender is not the owner or admin.
     */
    function _checkOwnerOrAdmin() internal view {
        if (owner() != _msgSender() && admin() != _msgSender()) {
            revert Adminable__NotAuthorized();
        }
    }

    /**
     * @dev Leaves the contract without admin. It will not be possible to call
     * `onlyAdmin` functions anymore. Can only be called by the current owner.
     *
     * NOTE: Renouncing adminship will leave the contract without an admin,
     * thereby removing any functionality that is only available to the admin.
     * The loyalty program will have to be managed by the owner.
     *
     * !!! MAKE SURE TO KNOW WHAT YOU ARE DOING !!!
     */
    function removeAdminship() public virtual onlyOwner {
        _transferAdminship(address(0));
    }

    /**
     * @dev Adds adminship of the contract to a new account (`to`).
     * Allows to add an admin back after it has been removed.
     * there can only be one admin at a time.
     * @param newAdmin the address of the new admin
     */
    function addAdminship(address newAdmin) public virtual onlyOwner {
        if (admin() != address(0)) revert Adminable__AdminAlreadySet();
        _transferAdminship(newAdmin);
    }

    /**
     * @dev Transfers adminship of the contract to a new account (`newAdmin`).
     * Can only be called by the current owner or admin.
     */
    function transferAdminship(address newAdmin) public virtual onlyOwnerOrAdmin {
        if (newAdmin == address(0)) revert Adminable__AddressZero();
        _transferAdminship(newAdmin);
    }

    /**
     * @dev Transfers adminship of the contract to a new account (`newAdmin`).
     * Internal function without access restriction.
     */
    function _transferAdminship(address newAdmin) internal virtual {
        address oldAdmin = _admin;
        _admin = newAdmin;
        emit AdminshipTransferred(oldAdmin, newAdmin);
    }
}
