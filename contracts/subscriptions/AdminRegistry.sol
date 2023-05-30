// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.18;

import {Context} from "@openzeppelin/contracts/utils/Context.sol";
import {Errors} from "../utils/Errors.sol";

/**
 * @title AdminRegistry;
 * @author Pierre Estrabaud (@Pedrojok01)
 * @notice Part of the Meed Loyalty Platform from SuperUltra
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

/** TODO:
 * - Add the Subscriptions address to the AdminRegistry so it can switch the admin status ?
 */

contract AdminRegistry is Context, Errors {
    address private _admin;
    address private _meedProgramFactory = address(0);

    struct UserStatus {
        bool exists;
        bool optedOut;
    }

    mapping(address => UserStatus) private _userStatuses;

    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);
    event MeedFactoryAddressSet(address indexed oldFactory, address indexed newFactory);
    event UserOptOutStatusChanged(address indexed user, bool optedOut);

    constructor(address newAdmin) {
        require(newAdmin != address(0), "AdminRegistry: address zero");
        _admin = newAdmin;
    }

    modifier onlyAdmin() {
        _checkAdmin();
        _;
    }

    modifier onlyAdminOrFactory() {
        _checkAdminOrFactory();
        _;
    }

    modifier onlyRegisteredUser() {
        if (!_userStatuses[_msgSender()].exists) revert AdminRegistry__UserNotRegistered();
        _;
    }

    function registerOwner(address newMeedOwner) external onlyAdminOrFactory {
        _userStatuses[newMeedOwner] = UserStatus({exists: true, optedOut: false});
    }

    /**
     * @dev The OptOut status is deactivated by default, so the admin can manage each program.
     * If the OptOut status is activated, it will leaves all contracts and promotions without admin.
     * It will not be possible to call `onlyAdmin` functions anymore.
     * Only the owner will be able to reactivate the admin.
     *
     * NOTE: Renouncing adminship will leave the contract without an admin,
     * thereby removing all functionalities that the admin can handle for the owner.
     * The loyalty program will have to be managed entirely and exclusively by the owner.
     *
     * !!! MAKE SURE TO KNOW WHAT YOU ARE DOING !!!
     */
    function switchAdminStatus() public onlyRegisteredUser {
        UserStatus storage status = _userStatuses[_msgSender()];
        status.optedOut = !status.optedOut;
        emit UserOptOutStatusChanged(_msgSender(), status.optedOut);
    }

    /**
     * @dev Transfers adminship of the contract to a new account (`newAdmin`).
     * Internal function without access restriction.
     */
    function transferAdmin(address newAdmin) external onlyAdmin {
        if (newAdmin == address(0)) {
            revert AdminRegistry__AddressZero();
        }
        address oldAdmin = _admin;
        _admin = newAdmin;
        emit AdminTransferred(oldAdmin, newAdmin);
    }

    /**
     * @dev Returns the address of the current admin.
     */
    function admin() public view virtual returns (address) {
        return _admin;
    }

    /**
     * @dev Returns true is a user exists (is owner of a MeedProgram).
     */
    function isExistingUser(address account) public view returns (bool) {
        return _userStatuses[account].exists;
    }

    /**
     * @dev Returns true if the user has opted out of adminship.
     */
    function isUserOptedOut(address account) public view returns (bool) {
        return _userStatuses[account].optedOut;
    }

    /**
     * @dev Allows to set the MeedProgramFactory address used in the modifer.
     */
    function setMeedFactoryAddress(address newFactory) external onlyAdmin {
        if (newFactory == address(0)) {
            revert AdminRegistry__AddressZero();
        }
        address oldFactory = _meedProgramFactory;
        _meedProgramFactory = newFactory;
        emit AdminTransferred(oldFactory, newFactory);
    }

    /**
     * @dev Throws if the sender is not the admin.
     */
    function _checkAdmin() private view {
        if (admin() != _msgSender()) {
            revert AdminRegistry__NotAuthorized();
        }
    }

    /**
     * @dev Throws if the sender is not the admin or the MeedProgram factory.
     */
    function _checkAdminOrFactory() private view {
        if (admin() != _msgSender() && _meedProgramFactory != _msgSender()) {
            revert AdminRegistry__NotAuthorized();
        }
    }
}
