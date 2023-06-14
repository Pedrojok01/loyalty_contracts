// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.19;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Errors} from "../utils/Errors.sol";

/**
 * @title Credits;
 * @author Pierre Estrabaud (@Pedrojok01)
 * @notice Part of the Meed Loyalty Platform
 * @dev Contract module which provides an access control mechanism based
 * on credits to limit the use of the admin mode.
 *
 * Works alongside the Subscription contract.
 */

contract Credits is Ownable, Errors {
  struct CreditPlan {
    uint256 credits;
    uint256 price;
  }

  /// @dev Different plans with corresponding credits and price
  CreditPlan[4] public creditPlans;

  /// @dev Mapping of user address to credits
  mapping(address => uint256) public userCredits;

  /// @dev Event for user credit change
  event CreditsAdded(address indexed user, uint256 totalCredits);
  event CreditsDeducted(address indexed user, uint256 totalCredits);

  constructor() {
    // Initialize with predefined plans
    creditPlans[0] = (CreditPlan(100, 0)); // Free trial
    creditPlans[0] = (CreditPlan(500, 0.02 ether));
    creditPlans[1] = (CreditPlan(5000, 0.15 ether));
    creditPlans[2] = (CreditPlan(25_000, 0.5 ether));
    creditPlans[3] = (CreditPlan(100_000, 1.5 ether));
  }

  /*///////////////////////////////////////////////////////////////////////////////
                                        WRITE
    ///////////////////////////////////////////////////////////////////////////////*/

  function buyCredits(uint8 planId) public payable {
    if (planId >= creditPlans.length) revert Credits__InvalidPlanId();

    CreditPlan memory plan = creditPlans[planId];
    if (msg.value < plan.price) revert Credits__InsufficientFunds();

    // Add credits to the user balance
    userCredits[_msgSender()] += plan.credits;
    emit CreditsAdded(_msgSender(), userCredits[_msgSender()]);

    // Refund excess payment
    if (msg.value > plan.price) {
      payable(_msgSender()).transfer(msg.value - plan.price);
    }
  }

  function setUserCredits(address user, uint256 credits) public onlyOwner {
    userCredits[user] = credits;
    emit CreditsAdded(user, credits);
  }

  function deductCredits(address user, uint256 credits) public onlyOwner {
    if (userCredits[user] < credits) revert Credits__InsufficientCredits();
    userCredits[user] -= credits;
    emit CreditsDeducted(user, credits);
  }

  // Owner can withdraw Ether from contract
  function withdraw() external onlyOwner {
    payable(owner()).transfer(address(this).balance);
  }

  /*///////////////////////////////////////////////////////////////////////////////
                                        VIEW
    ///////////////////////////////////////////////////////////////////////////////*/

  function getUserCredits(address user) public view returns (uint256) {
    return userCredits[user];
  }
}
