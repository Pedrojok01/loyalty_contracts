// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.20;

// import "hardhat/console.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {AdminRegistry} from "../subscriptions/AdminRegistry.sol";
import {Errors} from "../utils/Errors.sol";

/**
 * @title Credits;
 * @author @Pedrojok01
 * @notice Part of the Loyalty Platform
 * @dev Contract module which provides an access control mechanism based
 * on credits to limit the use of the admin mode.
 *
 * Works alongside the Subscription contract.
 */

contract Credits is Ownable, Errors {
  address private immutable ADMIN_REGISTRY_CONTRACT;
  uint256 internal monthlyCreditsForFreePlan = 100;
  uint256 internal monthlyCreditsForBasicPlan = 2_500;
  uint256 internal monthlyCreditsForProPlan = 10_000;
  uint256 internal monthlyCreditsForEnterprisePlan = 50_000;

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

  // solhint-disable-next-line no-unused-vars
  constructor(address adminRegistryAddress, address owner_) Ownable(owner_) {
    ADMIN_REGISTRY_CONTRACT = adminRegistryAddress;
    _initializeCreditsPlan();
  }

  /*///////////////////////////////////////////////////////////////////////////////
                                        WRITE
    ///////////////////////////////////////////////////////////////////////////////*/

  function buyCredits(uint8 planId) public payable virtual {
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
    userCredits[user] += credits;
    emit CreditsAdded(user, credits);
  }

  function deductCredits(address user, uint256 credits) public onlyOwner {
    if (userCredits[user] < credits) revert Credits__InsufficientCredits();
    userCredits[user] -= credits;
    emit CreditsDeducted(user, credits);
  }

  function setCreditPlan(uint8 planId, uint256 credits, uint256 price) public onlyOwner {
    creditPlans[planId] = CreditPlan(credits, price);
  }

  // function setAllCreditPlans(CreditPlan[4] memory newPlans) public onlyOwner {
  //   if (newPlans.length != creditPlans.length) revert Credits__InsufficientCredits();
  //   creditPlans = newPlans;
  // }

  // Owner can withdraw Ether from contract
  function withdraw() external virtual onlyOwner {
    payable(owner()).transfer(address(this).balance);
  }

  /*///////////////////////////////////////////////////////////////////////////////
                                        VIEW
    ///////////////////////////////////////////////////////////////////////////////*/

  function getUserCredits(address user) public view returns (uint256) {
    return userCredits[user];
  }

  function _autoAddUserCredits(address user, uint256 credits) internal {
    userCredits[user] += credits;
    emit CreditsAdded(user, credits);
  }

  function _autoRemoveUserCredits(address user) external {
    // solhint-disable-next-line avoid-tx-origin
    if (tx.origin != AdminRegistry(ADMIN_REGISTRY_CONTRACT).admin())
      revert AdminRegistry__NotAdmin();

    userCredits[user]--;
  }

  function _initializeCreditsPlan() private {
    // Initialize with predefined plans
    // creditPlans[0] = (CreditPlan(100, 0)); // Free trial
    creditPlans[0] = CreditPlan({credits: 500, price: 0.02 ether});
    creditPlans[1] = CreditPlan({credits: 5000, price: 0.15 ether});
    creditPlans[2] = CreditPlan({credits: 25_000, price: 0.5 ether});
    creditPlans[3] = CreditPlan({credits: 100_000, price: 1.5 ether});
  }
}
