// SPDX-License-Identifier: CC0-1.0
pragma solidity 0.8.18;

// import "hardhat/console.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Counters} from "../utils/Counters.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ISubscriptions} from "../interfaces/ISubscriptions.sol";
import {AdminRegistry} from "../subscriptions/AdminRegistry.sol";
import {Errors} from "../utils/Errors.sol";

/**
 * @title Subscription
 * @author Pierre Estrabaud (@Pedrojok01)
 * @notice Part of the Meed Loyalty Platform from SuperUltra
 * @dev Main Payment controller in charge of handling subscriptions and features access;
 *
 * Based on EIP: ERC5643
 *
 * TODO:
 *  - Handle case where a user has multiple subscriptions?
 *  - Implement a way to downgrade a subscription?
 *  - Add possible discount on upgrade ?? (ex: 10% off on upgrade from Basic to Pro)
 */

/**
 * Sighash   |   Function Signature
 * ========================
 * 21235083  =>  cancelSubscription(uint256)
 * a51cca63  =>  subscribe(Plan,bool)
 * 9f309450  =>  renewSubscription(uint256,Plan,bool)
 * 80c55351  =>  changeSubscriptionPlan(uint256,Plan)
 * c87b56dd  =>  tokenURI(uint256)
 * ae5e67a7  =>  isSubscribers(address)
 * e85c8f6d  =>  calculateSubscriptionPrice(Plan,bool)
 * 18160ddd  =>  totalSupply()
 * 5abf3838  =>  getSubscriber(address)
 * 17c95709  =>  expiresAt(uint256)
 * cde317af  =>  isRenewable(uint256)
 * d654db53  =>  getRemainingTimeAndPrice(uint256,Plan)
 * ae3486d2  =>  isProOrEnterprise(address)
 * 4f022b1c  =>  isEnterprise(address)
 * 01ffc9a7  =>  supportsInterface(bytes4)
 * 56508d6c  =>  editPlanPrice(Plan,uint256)
 * af933b57  =>  withdrawEther(address)
 * 80ae4ebc  =>  _initialize()
 * 7ee6931b  =>  _checkAmountPaid(Plan,bool)
 * 2e12cd4a  =>  _emitSubscriptionNFT(address)
 * b69fdf2e  =>  _onlySubscribers()
 */

contract Subscriptions is ERC721, ISubscriptions, Ownable, Errors {
  using Counters for Counters.Counter;

  /*///////////////////////////////////////////////////////////////////////////////
                                        STORAGE
    ///////////////////////////////////////////////////////////////////////////////*/

  Counters.Counter private _tokenIds;
  string[3] private baseURIs;

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

  modifier onlySubscribers() {
    _onlySubscribers();
    _;
  }

  /**
   * @param name_ The name of the NFT;
   * @param symbol_ The symbol of the NFT;
   * @param uris_  The base URIs of the NFTs;
   */
  constructor(
    string memory name_,
    string memory symbol_,
    string[3] memory uris_
  ) ERC721(name_, symbol_) {
    require(uris_.length == 3, "Subscriptions: Invalid URIs length");
    _initialize();
    baseURIs = uris_;
  }

  /*///////////////////////////////////////////////////////////////////////////////
                                        WRITE
    ///////////////////////////////////////////////////////////////////////////////*/

  /**
   * @dev Subscribe to Meed Rewards and emit a subscription NFT;
   * @param plan Chosen plan of the subscription (Basic, Pro, Enterprise)
   * @param duration Chosen duration of the subscription:
   *  - false = monthly (30 days);
   *  - true = anually (365 days);
   */
  function subscribe(Plan plan, bool duration) public payable {
    address subscriber = _msgSender();
    if (balanceOf(subscriber) != 0) revert Subscriptions__UserAlreadyOwnsSubscription();

    // Handle payment per tier & duration
    _checkAmountPaid(plan, duration);

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

    emit SubscriptionUpdate(tokenID, expiration);
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
    emit SubscriptionUpdate(tokenId, temp.expiration);
  }

  /**
   * @dev Change the plan of an existing subscription
   * @param tokenId the id of the subscription NFT
   * @param plan the chosen plan of the subscription (Basic, Pro, Enterprise)
   * @notice MUST be subscriber already
   */
  function changeSubscriptionPlan(uint256 tokenId, Plan plan) external payable onlySubscribers {
    address subscriber = _msgSender();
    if (ownerOf(tokenId) != subscriber) revert Subscriptions__TokenNotOwned();

    Subscriber memory temp = subscribers[subscriber];
    if (temp.plan >= plan) revert Subscriptions__CannotDowngradeTier(); // Simpler for now

    // Calculate payment adjustment for remaining time
    (uint256 remainingTime, uint256 cost) = getRemainingTimeAndPrice(tokenId, plan);
    if (msg.value != cost) revert Subscriptions__IncorrectPrice();
    temp.plan = plan;
    subscribers[subscriber] = temp;

    emit SubscriptionUpgraded(tokenId, remainingTime, cost);
  }

  event SubscriptionUpgraded(uint256 tokenId, uint256 remainingTime, uint256 cost);

  /**
   * @dev Cancel a subscription in case of auto-renewal
   * NOT IMPLEMENTED YET
   */
  // solhint-disable-next-line no-empty-blocks
  function cancelSubscription(uint256 tokenId) external view returns (bool) {}

  /*///////////////////////////////////////////////////////////////////////////////
                                            VIEW
    ///////////////////////////////////////////////////////////////////////////////*/

  /**
   * @dev Get the URI of the subscription NFT, based on the subscribed plan
   * @param tokenId The id of the subscription NFT
   */
  function tokenURI(uint256 tokenId) public view override returns (string memory) {
    if (!_exists(tokenId)) revert Subscriptions__NoSubscriptionFound();

    Subscriber memory subscriber = subscribers[ownerOf(tokenId)];

    if (subscriber.plan == Plan.BASIC) {
      return baseURIs[0];
    } else if (subscriber.plan == Plan.PRO) {
      return baseURIs[1];
    } else if (subscriber.plan == Plan.ENTERPRISE) {
      return baseURIs[2];
    } else {
      revert Subscriptions__InvalidPlan();
    }
  }

  /**
   * @notice Returns the details of a subscriber
   * @param subscriber The address of the subscriber
   */
  function isSubscribers(address subscriber) public view returns (bool) {
    if (subscribers[subscriber].expiration < block.timestamp)
      revert Subscriptions__SubscriptionExpired();
    return true;
  }

  /**
   * @dev Returns the price of a subscription, based on the plan and duration
   * @param plan the chosen plan of the subscription (Basic, Pro, Enterprise)
   * @param duration the chosen duration of the subscription (true = anually with 2 months off, false = monthly)
   */
  function calculateSubscriptionPrice(Plan plan, bool duration) public view returns (uint256) {
    return duration ? fees[plan] * 10 : fees[plan];
  }

  /**
   * @notice Returns the current total number of subscribers
   */
  function totalSupply() external view returns (uint256) {
    return _tokenIds.current();
  }

  /**
   * @notice Returns the details of a subscriber
   * @param subscriber The address of the subscriber
   */
  function getSubscriber(address subscriber) external view returns (Subscriber memory) {
    return subscribers[subscriber];
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
   * @dev Get the remaining time and the corresponding price to upgrade a subscription
   * @param tokenId the id of the subscription NFT
   * @param plan the choser plan of the subscription (Basic, Pro, Enterprise)
   * @return the remaining time left in the subscription
   * @return the cost difference of the remaining subscription time
   */
  function getRemainingTimeAndPrice(
    uint256 tokenId,
    Plan plan
  ) public view returns (uint256, uint256) {
    address owner = ownerOf(tokenId);

    Subscriber memory temp = subscribers[owner];
    if (temp.expiration <= block.timestamp) return (0, 0);

    // Calculate the remaining time left in the subscription
    uint256 remainingTime = temp.expiration - block.timestamp;
    uint256 remainingTimeInDay = (remainingTime + 120) / 1 days; // add 2 minutes buffer to round up

    // Calculate the cost difference of the remaining subscription time
    uint256 leftOnInitialPayment = ((fees[temp.plan] * remainingTimeInDay * 1000) / 30);
    uint256 cost = ((fees[plan] * remainingTimeInDay * 1000) / 30) - leftOnInitialPayment;

    return (remainingTime, cost / 1000);
  }

  /**
   * @dev Returns true if the subscriber is a PRO or ENTERPRISE plan
   * @param subscriber The address of the subscriber
   */
  function isProOrEnterprise(address subscriber) external view {
    isSubscribers(subscriber); // Check for subscriber only
    Plan _plan = subscribers[subscriber].plan;
    if (_plan != Plan.PRO && _plan != Plan.ENTERPRISE)
      revert Subscriptions__PleaseUpgradeYourPlan();
  }

  /**
   * @dev Returns true if the subscriber has an ENTERPRISE plan
   * @param subscriber The address of the subscriber
   */
  function isEnterprise(address subscriber) external view {
    isSubscribers(subscriber); // Check for subscriber only
    Plan _plan = subscribers[subscriber].plan;
    if (_plan != Plan.ENTERPRISE) revert Subscriptions__PleaseUpgradeYourPlan();
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
    fees[plan] = price;
    emit PriceUpdated(plan, price);
  }

  event PriceUpdated(Plan plan, uint256 price);

  /**
   * @dev Allows to withdraw the ether from the contract
   * @param to The address to send the ether to
   */
  function withdrawEther(address to) external onlyOwner {
    if (to == address(0)) revert Subscriptions__WithdrawToAddressZero();
    (bool sent, ) = to.call{value: address(this).balance}("");
    if (!sent) revert Subscriptions__WithdrawalFailed();
  }

  /*///////////////////////////////////////////////////////////////////////////////
                                INTERNAL / PRIVATE
    ///////////////////////////////////////////////////////////////////////////////*/

  /**
   * @dev Initialize the price of each plan in the contructor
   */
  function _initialize() private {
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
    _tokenIds.increment();
    uint40 newTokenId = _tokenIds.current();

    _tokenOfOwner[subscriber] = newTokenId;
    _mint(subscriber, newTokenId);
    return newTokenId;
  }

  /**
   * @dev Makes sure that the subscription is not expired
   */
  function _onlySubscribers() private view {
    if (subscribers[_msgSender()].expiration < block.timestamp)
      revert Subscriptions__SubscriptionExpired();
  }
}
