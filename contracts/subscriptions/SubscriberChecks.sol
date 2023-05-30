// SPDX-License-Identifier: CC0-1.0
pragma solidity 0.8.18;

import {Context} from "@openzeppelin/contracts/utils/Context.sol";
import {Errors} from "../utils/Errors.sol";

/**
 * @title SubscriberChecks
 * @author Pierre Estrabaud (@Pedrojok01)
 * @notice Part of the Meed Loyalty Platform from SuperUltra
 * @dev Provides modifiers to valid the plan of a subscriber.
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

    function _onlySubscribers(address subscriber) internal {
        (bool success, ) = SUBSCRIPTIONS_CONTRACT.call(abi.encodeWithSignature("isSubscribers(address)", subscriber));
        if (!success) {
            revert SubscriberChecks__PleaseSubscribeFirst();
        }
    }

    function _onlyProOrEnterprise(address subscriber) internal {
        (bool success, ) = SUBSCRIPTIONS_CONTRACT.call(
            abi.encodeWithSignature("isProOrEnterprise(address)", subscriber)
        );
        if (!success) {
            revert SubscriberChecks__PleaseSubscribeToProOrEnterpriseFirst();
        }
    }

    function _onlyEnterprise(address subscriber) internal {
        (bool success, ) = SUBSCRIPTIONS_CONTRACT.call(abi.encodeWithSignature("isEnterprise(address)", subscriber));
        if (!success) {
            revert SubscriberChecks__PleaseSubscribeToEnterpriseFirst();
        }
    }
}
