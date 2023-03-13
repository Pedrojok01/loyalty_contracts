// SPDX-License-Identifier: CC0-1.0
pragma solidity 0.8.18;

import "hardhat/console.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Counters} from "../utils/Counters.sol";
import {ISubscriptions} from "../interfaces/ISubscriptions.sol";
import {Errors} from "../utils/Errors.sol";

/**
 * @title Subscription
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
 *  - Add possible discount on upgrade ?? (ex: 10% off on upgrade from Basic to Pro)
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
                                        MODIFIERS
    ///////////////////////////////////////////////////////////////////////////////*/

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

    constructor(string memory name_, string memory symbol_, string[3] memory uris_) ERC721(name_, symbol_) {
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

        uint64 expiration = duration ? uint64(block.timestamp + 365 days) : uint64(block.timestamp + 30 days);
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

        if (temp.plan != plan) {
            if (temp.expiration > block.timestamp) revert Subscriptions__UpgradePlanBeforeRenewal();

            // Update subscription (expiration, startTime & plan)
            temp.expiration = duration ? uint64(block.timestamp + 365 days) : uint64(block.timestamp + 30 days);
            temp.startTime = uint64(block.timestamp);
            temp.plan = plan;

            subscribers[subscriber] = temp;

            emit SubscriptionUpdate(tokenId, temp.expiration);
        } else {
            // Update subscription expiration
            uint64 durationToAdd = duration ? 365 days : 30 days;
            if (temp.expiration < block.timestamp) {
                temp.expiration = uint64(block.timestamp + durationToAdd);
            } else {
                temp.expiration += durationToAdd;
            }

            subscribers[subscriber] = temp;

            emit SubscriptionUpdate(tokenId, temp.expiration);
        }
    }

    /**
     * @dev Change the plan of an existing subscription
     */
    function changeSubscriptionPlan(uint256 tokenId, Plan plan) external payable onlySubscribers {
        address subscriber = _msgSender();
        if (ownerOf(tokenId) != subscriber) revert Subscriptions__TokenNotOwned();

        Subscriber memory temp = subscribers[subscriber];
        if (temp.plan >= plan) revert Subscriptions__CannotDowngradeTier(); // Simpler for now

        // Calculate payment adjustment for remaining time
        (uint256 remainingTime, uint256 cost) = this.getRemainingTimeAndPrice(tokenId, plan);
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

    function totalSupply() external view returns (uint256) {
        return _tokenIds.current();
    }

    function getSubscriber(address user) external view returns (Subscriber memory) {
        return subscribers[user];
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

    function calculateSubscriptionPrice(Plan plan, bool duration) public view returns (uint256) {
        return duration ? fees[plan] * 10 : fees[plan];
    }

    function getRemainingTimeAndPrice(uint256 tokenId, Plan plan) external view returns (uint256, uint256) {
        address owner = ownerOf(tokenId);

        Subscriber memory temp = subscribers[owner];
        if (temp.expiration <= block.timestamp) return (0, 0);

        // Calculate the remaining time left in the subscription
        uint256 remainingTime = temp.expiration - block.timestamp;
        uint256 remainingTimeInDay = (remainingTime + 120) / 1 days; // add 2 minutes buffer to round up

        // Calculate the cost difference of the remaining subscription time
        uint256 leftOnInitialPayment = ((fees[temp.plan] * remainingTimeInDay) / 30);
        uint256 cost = ((fees[plan] * remainingTimeInDay) / 30) - leftOnInitialPayment;

        return (remainingTime, cost);
    }

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

    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == type(ISubscriptions).interfaceId || super.supportsInterface(interfaceId);
    }

    /*///////////////////////////////////////////////////////////////////////////////
                                        RESTRICTED
    ///////////////////////////////////////////////////////////////////////////////*/

    function editPlanPrice(Plan plan, uint256 price) external onlyOwner {
        fees[plan] = price;
        emit PriceUpdated(plan, price);
    }

    event PriceUpdated(Plan plan, uint256 price);

    function withdrawEther(address to) external onlyOwner {
        if (to == address(0)) revert Subscriptions__WithdrawToAddressZero();
        (bool sent, ) = to.call{value: address(this).balance}("");
        if (!sent) revert Subscriptions__WithdrawalFailed();
    }

    /*///////////////////////////////////////////////////////////////////////////////
                                INTERNAL / PRIVATE
    ///////////////////////////////////////////////////////////////////////////////*/

    function _initialize() private {
        fees[Plan.BASIC] = 0.05 ether;
        fees[Plan.PRO] = 0.1 ether;
        fees[Plan.ENTERPRISE] = 0.5 ether;
    }

    function _checkAmountPaid(Plan plan, bool duration) private view {
        uint256 toPay = calculateSubscriptionPrice(plan, duration);
        if (toPay != msg.value) revert Subscriptions__IncorrectPrice();
    }

    function _emitSubscriptionNFT(address subscriber) private returns (uint40) {
        _tokenIds.increment();
        uint40 newTokenId = _tokenIds.current();

        _tokenOfOwner[subscriber] = newTokenId;
        _mint(subscriber, newTokenId);
        return newTokenId;
    }

    function _onlySubscribers() private view {
        if (subscribers[_msgSender()].expiration < block.timestamp) revert Subscriptions__SubscriptionExpired();
    }

    function _onlyProOrEnterprise() private view {
        _onlySubscribers(); // Check for subscriber only
        Plan _plan = subscribers[_msgSender()].plan;
        if (_plan != Plan.PRO && _plan != Plan.ENTERPRISE) revert Subscriptions__PleaseUpgradeYourPlan();
    }

    function _onlyEnterprise() private view {
        _onlySubscribers(); // Check for subscriber only
        Plan _plan = subscribers[_msgSender()].plan;
        if (_plan != Plan.ENTERPRISE) revert Subscriptions__PleaseUpgradeYourPlan();
    }
}
