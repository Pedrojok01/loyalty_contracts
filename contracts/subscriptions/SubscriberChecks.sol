// SPDX-License-Identifier: CC0-1.0
pragma solidity 0.8.18;

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

contract SubscriberChecks is Errors {
    address private immutable SUBSCRIPTIONS_CONTRACT;

    constructor(address _subscriptionsContract) {
        SUBSCRIPTIONS_CONTRACT = _subscriptionsContract;
    }

    modifier onlySubscribers() {
        _onlySubscribers();
        _;
    }

    modifier onlyProOrEnterprise() {
        _onlyProOrEnterprise();
        _;
    }

    modifier onlyEnterprise() {
        _onlyEnterprise();
        _;
    }

    function _onlySubscribers() private {
        (bool success, ) = SUBSCRIPTIONS_CONTRACT.call(abi.encodeWithSignature("onlySubscribers()"));
        if (!success) {
            revert SubscriberChecks__PleaseSubscribeFirst();
        }
    }

    function _onlyProOrEnterprise() private {
        (bool success, ) = SUBSCRIPTIONS_CONTRACT.call(abi.encodeWithSignature("onlyProOrEnterprise()"));
        if (!success) {
            revert SubscriberChecks__PleaseSubscribeToProOrEnterpriseFirst();
        }
    }

    function _onlyEnterprise() private {
        (bool success, ) = SUBSCRIPTIONS_CONTRACT.call(abi.encodeWithSignature("onlyEnterprise()"));
        if (!success) {
            revert SubscriberChecks__PleaseSubscribeToEnterpriseFirst();
        }
    }
}
