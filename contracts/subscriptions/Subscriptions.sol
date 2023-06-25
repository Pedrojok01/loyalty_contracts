// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.19;

// import "hardhat/console.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

import {ISubscriptions} from "../interfaces/ISubscriptions.sol";
import {AdminRegistry} from "../subscriptions/AdminRegistry.sol";
import {Credits} from "../utils/Credits.sol";

/**
 * @title Subscription
 * @author Pierre Estrabaud (@Pedrojok01)
 * @notice Part of the Meed Loyalty Platform
 * @dev Main Payment controller in charge of handling subscriptions and features access;
 *
 * Based on EIP: ERC5643
 *
 * @todo
 *  - Handle case where a user has multiple subscriptions?
 *  - Implement a way to downgrade a subscription?
 *  - Add possible discount on upgrade ?? (ex: 10% off on upgrade from Basic to Pro)
 */

/**
 * Sighash   |   Function Signature
 * =================================
 * 21235083  =>  cancelSubscription(uint256)
 * a51cca63  =>  subscribe(Plan,bool)
 * 9f309450  =>  renewSubscription(uint256,Plan,bool)
 * 80c55351  =>  changeSubscriptionPlan(uint256,Plan)
 * c4804ef0  =>  isSubscriber(address)
 * 7f432517  =>  isPaidSubscriber(address)
 * 5abf3838  =>  getSubscriber(address)
 * b6f92b5c  =>  getSubscriberPlan(address)
 * e85c8f6d  =>  calculateSubscriptionPrice(Plan,bool)
 * 18160ddd  =>  totalSupply()
 * c87b56dd  =>  tokenURI(uint256)
 * 17c95709  =>  expiresAt(uint256)
 * cde317af  =>  isRenewable(uint256)
 * d654db53  =>  getRemainingTimeAndPrice(uint256,Plan)
 * ae3486d2  =>  isProOrEnterprise(address)
 * 4f022b1c  =>  isEnterprise(address)
 * 01ffc9a7  =>  supportsInterface(bytes4)
 * 56508d6c  =>  editPlanPrice(Plan,uint256)
 * af933b57  =>  withdraw(address)
 * 80ae4ebc  =>  _initialize()
 * 7ee6931b  =>  _checkAmountPaid(Plan,bool)
 * 2e12cd4a  =>  _emitSubscriptionNFT(address)
 * b887b4b6  =>  _isPaidPlan(Plan)
 * aea0b886  =>  _isValidPlan(Plan)
 */

contract Subscriptions is ERC721, ISubscriptions, Credits {
  /*///////////////////////////////////////////////////////////////////////////////
                                        STORAGE
    ///////////////////////////////////////////////////////////////////////////////*/

  uint40 private _tokenIdCounter;
  string[4] private baseURIs;
  uint256 private constant TIME_UNIT_CONVERSION = 120;

  struct Subscriber {
    Plan plan; // 1 byte
    uint40 tokenId; // 5 bytes
    uint64 expiration; // 8 bytes
    uint64 startTime; // 8 bytes
  }

  mapping(Plan => uint256) public fees; // Map plan to price
  mapping(address => uint40) private _tokenOfOwner; // Map user to tokenId
  mapping(address => Subscriber) private subscribers; // Map user to subscriber

  /*///////////////////////////////////////////////////////////////////////////////
                                MODIFIERS / CONSTRUCTOR
    ///////////////////////////////////////////////////////////////////////////////*/

  /**
   * @param name_ The name of the NFT;
   * @param symbol_ The symbol of the NFT;
   * @param uris_  The base URIs of the NFTs;
   */
  constructor(
    string memory name_,
    string memory symbol_,
    string[4] memory uris_,
    address adminRegistryAddress
  ) ERC721(name_, symbol_) Credits(adminRegistryAddress) {
    require(uris_.length == 4, "Subscriptions: Invalid URIs length");
    _initialize();
    baseURIs = uris_;
  }

  modifier onlySubscriber(address subscriber) {
    _onlySubscriber(subscriber);
    _;
  }

  /*///////////////////////////////////////////////////////////////////////////////
                                        WRITE
    ///////////////////////////////////////////////////////////////////////////////*/

  /**
   * @dev Allows anyone to start a free trial of 1 month with 100 credits;
   * @notice This function is only callable once per address;
   */
  function startTrial() public {
    address subscriber = _msgSender();
    if (balanceOf(subscriber) != 0) revert Subscriptions__UserAlreadyOwnsSubscription();

    _addNewSubscriber(subscriber, Plan.FREE, false);
    _autoAddUserCredits(subscriber, 100);
  }

  /**
   * @dev Subscribe to Meed Rewards and emit a subscription NFT;
   * @param plan Chosen plan of the subscription (Basic, Pro, Enterprise)
   * @param duration Chosen duration of the subscription:
   *  - false = monthly (30 days);
   *  - true = anually (365 days);
   */
  function subscribe(Plan plan, bool duration) external payable {
    address subscriber = _msgSender();
    if (balanceOf(subscriber) != 0) revert Subscriptions__UserAlreadyOwnsSubscription();

    // Handle payment per tier & duration
    if (!_isPaidPlan(plan)) revert Subscriptions__InvalidPlan();

    _checkAmountPaid(plan, duration);
    _addNewSubscriber(subscriber, plan, duration);
    _addCreditsWithSubscription(subscriber, plan, duration);
  }

  /**
   * @dev Renew an existing subscription, expired or not
   * @param tokenId the id of the subscription NFT
   * @param plan the choser plan of the subscription
   * @param duration the chosen duration of the subscription (true = anually, false = monthly)
   */
  function renewSubscription(uint256 tokenId, Plan plan, bool duration) external payable {
    address subscriber = _msgSender();
    if (ownerOf(tokenId) != subscriber) revert Subscriptions__TokenNotOwned();
    Subscriber memory temp = subscribers[subscriber];

    // Handle payment per tier & duration
    if (!_isPaidPlan(plan)) revert Subscriptions__InvalidPlan();
    _checkAmountPaid(plan, duration);

    uint64 durationToAdd = duration ? 365 days : 30 days;

    // Case upgrade: renew with upgrade ONLY if expired
    if (temp.plan != plan) {
      if (temp.expiration > block.timestamp) revert Subscriptions__UpgradePlanBeforeRenewal();

      // If expired, reset subscription (expiration, startTime & plan)
      temp.expiration = uint64(block.timestamp + durationToAdd);
      temp.startTime = uint64(block.timestamp);
      temp.plan = plan;
    } else {
      // Update subscription expiration
      if (temp.expiration < block.timestamp) {
        temp.expiration = uint64(block.timestamp + durationToAdd);
      } else {
        temp.expiration += durationToAdd;
      }
    }

    subscribers[subscriber] = temp;

    _addCreditsWithSubscription(subscriber, plan, duration);

    emit SubscribedOrExtended(subscriber, tokenId, temp.expiration);
  }

  /**
   * @dev Change the plan of an existing subscription
   * @param tokenId the id of the subscription NFT
   * @param plan the chosen plan of the subscription (Basic, Pro, Enterprise)
   * @notice MUST be subscriber already
   */
  function changeSubscriptionPlan(
    uint256 tokenId,
    Plan plan
  ) external payable onlySubscriber(_msgSender()) {
    address subscriber = _msgSender();
    if (ownerOf(tokenId) != subscriber) revert Subscriptions__TokenNotOwned();

    Subscriber memory temp = subscribers[subscriber];

    if (temp.plan >= plan) revert Subscriptions__CannotDowngradeTier(); // Simpler for now

    // Calculate payment adjustment for remaining time
    (uint256 remainingTime, uint256 cost) = getRemainingTimeAndPrice(tokenId, plan);
    if (msg.value != cost) revert Subscriptions__IncorrectPrice();
    temp.plan = plan;
    subscribers[subscriber] = temp;

    emit SubscriptionUpgraded(subscriber, tokenId, remainingTime, cost);
  }

  /**
   * @dev Cancel a subscription in case of auto-renewal
   * NOT IMPLEMENTED YET
   */
  // solhint-disable-next-line no-empty-blocks
  function cancelSubscription(uint256 tokenId) external view returns (bool) {}

  /**
   * @dev Allows to topup credits for a user
   * @param planId the id of the plan to buy credits for
   */
  function buyCredits(uint8 planId) public payable override onlySubscriber(_msgSender()) {
    CreditPlan memory plan = creditPlans[planId];
    if (msg.value < plan.price) revert Credits__InsufficientFunds();

    // Add credits to the user balance
    userCredits[_msgSender()] += plan.credits;
    emit CreditsAdded(_msgSender(), userCredits[_msgSender()]);

    // Refund excess payment
    if (msg.value > plan.price) {
      (bool success, ) = _msgSender().call{value: msg.value - plan.price}("");
      require(success, "Subscriptions: Failed to refund excess payment");
    }
  }

  /*///////////////////////////////////////////////////////////////////////////////
                                            VIEW
    ///////////////////////////////////////////////////////////////////////////////*/

  /**
   * @notice Returns the details of a subscriber
   * @param subscriber The address of the subscriber
   */
  function isSubscriber(address subscriber) public view returns (bool) {
    return subscribers[subscriber].expiration >= block.timestamp;
  }

  /**
   * @notice Returns true if the subscriber's plan is not FREE
   * @param subscriber The address of the subscriber
   */
  function isPaidSubscriber(address subscriber) public view returns (bool) {
    return isSubscriber(subscriber) && subscribers[subscriber].plan != Plan.FREE;
  }

  /**
   * @notice Returns the details of a subscriber
   * @param subscriber The address of the subscriber
   */
  function getSubscriber(address subscriber) external view returns (Subscriber memory) {
    return subscribers[subscriber];
  }

  /**
   * @notice Returns the details of a subscriber
   * @param subscriber The address of the subscriber
   */
  function getSubscriberPlan(address subscriber) public view returns (Plan) {
    if (!isSubscriber(subscriber) || !isPaidSubscriber(subscriber)) {
      return Plan.FREE;
    } else {
      return subscribers[subscriber].plan;
    }
  }

  /**
   * @dev Returns the price of a subscription, based on the plan and duration
   * @param plan the chosen plan of the subscription (Basic, Pro, Enterprise)
   * @param duration the chosen duration of the subscription (true = anually with 2 months off, false = monthly)
   */
  function calculateSubscriptionPrice(Plan plan, bool duration) public view returns (uint256) {
    if (!_isPaidPlan(plan)) revert Subscriptions__InvalidPlan();
    return duration ? fees[plan] * 10 : fees[plan];
  }

  /**
   * @notice Returns the current total number of subscribers
   */
  function totalSupply() external view returns (uint256) {
    return _tokenIdCounter;
  }

  /**
   * @dev Get the URI of the subscription NFT, based on the subscribed plan
   * @param tokenId The id of the subscription NFT
   */
  function tokenURI(uint256 tokenId) public view override returns (string memory) {
    if (!_exists(tokenId)) revert Subscriptions__NoSubscriptionFound(tokenId);

    Subscriber memory subscriber = subscribers[ownerOf(tokenId)];
    if (subscriber.expiration < block.timestamp || subscriber.plan == Plan.FREE) {
      return baseURIs[0];
    } else if (subscriber.plan == Plan.BASIC) {
      return baseURIs[1];
    } else if (subscriber.plan == Plan.PRO) {
      return baseURIs[2];
    } else if (subscriber.plan == Plan.ENTERPRISE) {
      return baseURIs[3];
    } else {
      revert Subscriptions__InvalidPlan();
    }
  }

  /**
   * @notice Returns the expiration date of a subscription
   * @param tokenId The id of the subscription
   * @return The expiration date of the subscription
   */
  function expiresAt(uint256 tokenId) external view returns (uint64) {
    return subscribers[ownerOf(tokenId)].expiration;
  }

  /**
   * @notice Returns true if the subsciption is renewable (always true for this contract)
   * @param tokenId The id of the subscription
   */
  function isRenewable(uint256 tokenId) external view returns (bool) {
    if (_exists(tokenId)) return true;
    return false;
  }

  /**
   * @notice Get the remaining time and the corresponding price to upgrade a subscription
   * @dev Calculates the remaining time and cost difference of a subscription given the tokenId and plan
   * @param tokenId the id of the subscription NFT
   * @param plan the chosen plan of the subscription (Free, Basic, Pro, Enterprise)
   * @return the remaining time left in the subscription
   * @return the cost difference of the remaining subscription time
   */
  function getRemainingTimeAndPrice(
    uint256 tokenId,
    Plan plan
  ) public view returns (uint256, uint256) {
    if (tokenId == 0 || !_exists(tokenId)) revert Subscriptions__NoSubscriptionFound(tokenId);

    address _owner = ownerOf(tokenId);
    Subscriber memory temp = subscribers[_owner];

    if (temp.expiration <= block.timestamp) {
      return (0, 0);
    }

    uint256 remainingTime = temp.expiration - block.timestamp;
    uint256 remainingTimeInDay = (remainingTime + TIME_UNIT_CONVERSION) / 1 days; // add 2 minutes buffer to round up

    uint256 baseValue = (remainingTimeInDay * 1000) / 30;
    uint256 newCost = fees[plan] * baseValue;
    uint256 leftOnInitialPayment = fees[temp.plan] * baseValue;

    uint256 cost;
    if (newCost >= leftOnInitialPayment) {
      cost = newCost - leftOnInitialPayment;
    } else {
      cost = 0;
    }

    return (remainingTime, cost / 1000);
  }

  /**
   * @dev Returns true if the subscriber has a PRO or ENTERPRISE plan
   * @param subscriber The address of the subscriber
   */
  function isProOrEnterprise(address subscriber) external view returns (bool) {
    return
      isPaidSubscriber(subscriber) &&
      (subscribers[subscriber].plan == Plan.PRO || subscribers[subscriber].plan == Plan.ENTERPRISE);
  }

  /**
   * @dev Returns true if the subscriber has an ENTERPRISE plan
   * @param subscriber The address of the subscriber
   */
  function isEnterprise(address subscriber) external view returns (bool) {
    return isPaidSubscriber(subscriber) && subscribers[subscriber].plan == Plan.ENTERPRISE;
  }

  function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
    return interfaceId == type(ISubscriptions).interfaceId || super.supportsInterface(interfaceId);
  }

  /*///////////////////////////////////////////////////////////////////////////////
                                        RESTRICTED
    ///////////////////////////////////////////////////////////////////////////////*/

  /**
   * @dev Allows to change the price of a plan
   * @param plan the plan to change the price of
   * @param price the new price of the plan (in ether)
   */
  function editPlanPrice(Plan plan, uint256 price) external onlyOwner {
    if (!_isPaidPlan(plan)) revert Subscriptions__InvalidPlan();
    fees[plan] = price;
    emit PriceUpdated(plan, price);
  }

  event PriceUpdated(Plan plan, uint256 price);

  /**
   * @dev Allows to withdraw the ether from the contract
   */
  function withdraw() external override onlyOwner {
    (bool sent, ) = owner().call{value: address(this).balance}("");
    if (!sent) revert Subscriptions__WithdrawalFailed();
  }

  /*///////////////////////////////////////////////////////////////////////////////
                                INTERNAL / PRIVATE
    ///////////////////////////////////////////////////////////////////////////////*/

  /**
   * @dev Initialize the price of each plan in the contructor
   */
  function _initialize() private {
    fees[Plan.FREE] = 0;
    fees[Plan.BASIC] = 0.05 ether;
    fees[Plan.PRO] = 0.1 ether;
    fees[Plan.ENTERPRISE] = 0.5 ether;
  }

  /**
   * @dev Ensure that the amount paid is correct, and that the transfer went through
   * @param plan the chosen plan of the subscription (Basic, Pro, Enterprise)
   * @param duration the chosen duration of the subscription (true = anually, false = monthly)
   */
  function _checkAmountPaid(Plan plan, bool duration) private view {
    uint256 toPay = calculateSubscriptionPrice(plan, duration);
    if (toPay != msg.value) revert Subscriptions__IncorrectPrice();
  }

  /**
   * @dev Mint a new subscription NFT
   * @param subscriber The address of the subscriber
   */
  function _emitSubscriptionNFT(address subscriber) private returns (uint40) {
    _tokenIdCounter++;
    uint40 newTokenId = _tokenIdCounter;

    _tokenOfOwner[subscriber] = newTokenId;
    _mint(subscriber, newTokenId);
    return newTokenId;
  }

  /**
   * @dev Returns true if the plan is a valid paid plan
   */
  function _isPaidPlan(Plan plan) private pure returns (bool) {
    if (plan == Plan.FREE) return false;
    return true;
  }

  function _onlySubscriber(address subscriber) private {
    if (subscribers[subscriber].expiration < block.timestamp) {
      subscribers[subscriber].plan = Plan.FREE;
      revert Subscriptions__SubscriptionExpired();
    }
  }

  function _addNewSubscriber(address subscriber, Plan plan, bool duration) private {
    uint64 expiration = duration
      ? uint64(block.timestamp + 365 days)
      : uint64(block.timestamp + 30 days);
    uint40 tokenID = _emitSubscriptionNFT(subscriber);

    Subscriber memory newSubscriber = Subscriber({
      tokenId: tokenID,
      expiration: expiration,
      plan: plan,
      startTime: uint64(block.timestamp)
    });

    subscribers[subscriber] = newSubscriber;
    _tokenOfOwner[subscriber] = tokenID;

    emit SubscribedOrExtended(subscriber, tokenID, expiration);
  }

  function _addCreditsWithSubscription(address subscriber, Plan plan, bool duration) private {
    // Calculate credits based on plan and duration
    uint256 creditsPerMonth = 0;
    if (plan == Plan.BASIC) {
      creditsPerMonth = monthlyCreditsForBasicPlan;
    } else if (plan == Plan.PRO) {
      creditsPerMonth = monthlyCreditsForProPlan;
    } else if (plan == Plan.ENTERPRISE) {
      creditsPerMonth = monthlyCreditsForEnterprisePlan;
    }
    uint256 totalCredits = creditsPerMonth * (duration ? 12 : 1);

    // Give credits to the subscriber
    _autoAddUserCredits(subscriber, totalCredits);
  }
}
