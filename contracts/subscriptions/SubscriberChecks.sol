// SPDX-License-Identifier: CC0-1.0
pragma solidity ^0.8.20;

// import "hardhat/console.sol";
import {Context} from "@openzeppelin/contracts/utils/Context.sol";
import {Errors} from "../utils/Errors.sol";

/**
 * @title SubscriberChecks
 * @author @Pedrojok01
 * @notice Part of the Loyalty Platform
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

  /**
   * @dev Return the subscription plan of a subscriber.
   * @param subscriber Address of the loyaltyProgram owner
   */
  function _getSubscriberPlan(address subscriber) internal returns (uint256) {
    (bool success, bytes memory data) = SUBSCRIPTIONS_CONTRACT.call(
      abi.encodeWithSignature("getSubscriberPlan(address)", subscriber)
    );

    if (!success) {
      revert SubscriberChecks__PleaseSubscribeFirst();
    }

    return abi.decode(data, (uint));
  }

  /**
   * @dev Throws if the sender is not a subscriber.
   * @param subscriber Address of the loyaltyProgram owner
   */
  function _onlySubscribers(address subscriber) internal {
    (bool success, bytes memory result) = SUBSCRIPTIONS_CONTRACT.call(
      abi.encodeWithSignature("isPaidSubscriber(address)", subscriber)
    );
    if (!success || abi.decode(result, (bool)) == false) {
      revert SubscriberChecks__PleaseSubscribeFirst();
    }
  }

  /**
   * @dev Throws if the sender is not a Pro or Enterprise subscriber.
   * @param subscriber Address of the loyaltyProgram owner
   */
  function _onlyProOrEnterprise(address subscriber) internal {
    (bool success, bytes memory result) = SUBSCRIPTIONS_CONTRACT.call(
      abi.encodeWithSignature("isProOrEnterprise(address)", subscriber)
    );
    if (!success || abi.decode(result, (bool)) == false) {
      revert SubscriberChecks__PleaseSubscribeToProOrEnterpriseFirst();
    }
  }

  /**
   * @dev Throws if the sender is not an Enterprise subscriber.
   * @param subscriber Address of the loyaltyProgram owner
   */
  function _onlyEnterprise(address subscriber) internal {
    (bool success, bytes memory result) = SUBSCRIPTIONS_CONTRACT.call(
      abi.encodeWithSignature("isEnterprise(address)", subscriber)
    );
    if (!success || abi.decode(result, (bool)) == false) {
      revert SubscriberChecks__PleaseSubscribeToEnterpriseFirst();
    }
  }
}
