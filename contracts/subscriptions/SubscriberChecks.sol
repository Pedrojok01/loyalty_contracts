// SPDX-License-Identifier: CC0-1.0
pragma solidity 0.8.18;

// import "hardhat/console.sol";
import {Context} from "@openzeppelin/contracts/utils/Context.sol";
import {Errors} from "../utils/Errors.sol";

/**
 * @title SubscriberChecks
 * @author Pierre Estrabaud (@Pedrojok01)
 * @notice Part of the Meed Rewards platform from SuperUltra
 * @dev Provides safe getter and setter for promotion status and type.
 *
 * Based on EIP: ERC5643
 *
 * TODO:
 *  - Handle case where a user has multiple subscriptions
 *  - Handle case where a user pay for a plan and immediately upgrade (cheating)
 *  - Implement a way to downgrade a subscription
 */

contract SubscriberChecks is Context, Errors {
    address private immutable SUBSCRIPTIONS_CONTRACT;

    constructor(address _subscriptionsContract) {
        SUBSCRIPTIONS_CONTRACT = _subscriptionsContract;
    }

    modifier onlySubscribers() {
        _onlySubscribers(_msgSender());
        _;
    }

    modifier onlyProOrEnterprise() {
        _onlyProOrEnterprise(_msgSender());
        _;
    }

    modifier onlyEnterprise() {
        _onlyEnterprise(_msgSender());
        _;
    }

    function _onlySubscribers(address subscriber) private {
        (bool success, ) = SUBSCRIPTIONS_CONTRACT.call(abi.encodeWithSignature("isSubscribers(address)", subscriber));
        if (!success) {
            revert SubscriberChecks__PleaseSubscribeFirst();
        }
    }

    function _onlyProOrEnterprise(address subscriber) private {
        (bool success, ) = SUBSCRIPTIONS_CONTRACT.call(
            abi.encodeWithSignature("isProOrEnterprise(address)", subscriber)
        );
        if (!success) {
            revert SubscriberChecks__PleaseSubscribeToProOrEnterpriseFirst();
        }
    }

    function _onlyEnterprise(address subscriber) private {
        (bool success, ) = SUBSCRIPTIONS_CONTRACT.call(abi.encodeWithSignature("isEnterprise(address)", subscriber));
        if (!success) {
            revert SubscriberChecks__PleaseSubscribeToEnterpriseFirst();
        }
    }
}
