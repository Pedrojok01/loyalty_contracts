// SPDX-License-Identifier: CC0-1.0
pragma solidity 0.8.18;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Counters} from "../utils/Counters.sol";
import {ISubscriptions} from "../interfaces/ISubscriptions.sol";
import {Errors} from "../utils/Errors.sol";

/**
 * @title Subscription
 * @author Pierre Estrabaud (@Pedrojok01)
 * @notice Part of the Loyal-T platform from SuperUltra
 * @dev Provides safe getter and setter for promotion status and type.
 *
 * Based on EIP: ERC5643
 * Include with `using Promotions for PromoLib.Promotion;`
 */

contract Subscriptions is ERC721, ISubscriptions, Ownable, Errors {
    using Counters for Counters.Counter;

    Counters.Counter private _tokenIds;
    mapping(address => bool) private _hasSubscription; // Map user to subscription status
    mapping(uint256 => uint64) private _subscriptions; // Map tokenId to expiration date

    uint256 public basicPrice = 0.05 ether;
    uint256 public proPrice = 0.1 ether;
    uint256 public enterprisePrice = 0.5 ether;

    event SubscriptionUpdate(uint256 indexed tokenId, uint64 expiration);

    constructor(string memory name_, string memory symbol_, string memory uri) ERC721(name_, symbol_) {}

    function subscribe(uint256 tier, bool duration) external returns (uint256) {
        uint256 pricePerTier = _getPricePerTier(tier);
        uint256 toPay = duration ? pricePerTier * 12 : pricePerTier;

        address subscriber = _msgSender();

        // Check if user already owns a subscription NFT
        if (balanceOf(subscriber) == 0) {
            _tokenIds.increment();
            uint256 newTokenId = _tokenIds.current();
            _mint(subscriber, newTokenId);
        } else {
            if (_hasSubscription[subscriber]) revert Subscriptions__UserAlreadyOwnsSubscription();
        }

        assert(balanceOf(subscriber) == 1);

        _hasSubscription[to] = true;
        _subscriptions[newTokenId] = uint64(block.timestamp + 30 days);
        emit SubscriptionUpdate(newTokenId, _subscriptions[newTokenId]);
        return newTokenId;
    }

    function buyAnnualSubscription() external payable {
        require(!_hasSubscription[_msgSender()], "Subscriptions: User already owns a subscription");
        require(msg.value == annualPrice, "Subscriptions: Incorrect price");
        _tokenIds.increment();
        uint256 newTokenId = _tokenIds.current();
        _mint(_msgSender(), newTokenId);
        _hasSubscription[_msgSender()] = true;
        _subscriptions[newTokenId] = uint64(block.timestamp + 365 days);
        emit SubscriptionUpdate(newTokenId, _subscriptions[newTokenId]);
    }

    function renewSubscription(uint256 tokenId, uint64 expiration) external payable {
        require(_subscriptions[tokenId] > 0, "Subscriptions: Subscription does not exist");
        if (!_isApprovedOrOwner(_msgSender(), tokenId)) revert Subscriptions__NotOwnerOrApproved();

        uint256 price = (monthlyPrice * (expiration - block.timestamp)) / 30 days;
        if (msg.value != price) revert Subscriptions__IncorrectPrice();

        _subscriptions[tokenId] = expiration;
        emit SubscriptionUpdate(tokenId, expiration);
    }

    function cancelSubscription(uint256 tokenId) external {
        require(_subscriptions[tokenId] > 0, "Subscriptions: Subscription does not exist");
        if (!_isApprovedOrOwner(_msgSender(), tokenId)) revert Subscriptions__NotOwnerOrApproved();
        delete _subscriptions[tokenId];
        _hasSubscription[_msgSender()] = false;
        emit SubscriptionUpdate(tokenId, 0);
    }

    /*///////////////////////////////////////////////////////////////////////////////
                                            VIEW
    ///////////////////////////////////////////////////////////////////////////////*/

    /**
     * @notice Returns the expiration date of a subscription
     * @param tokenId The id of the subscription
     * @return The expiration date of the subscription
     */
    function expiresAt(uint256 tokenId) external view returns (uint64) {
        return _subscriptions[tokenId];
    }

    /**
     * @notice Returns true if the subsciption is renewable (always true for this contract)
     * @param tokenId The id of the subscription
     */
    function isRenewable(uint256 tokenId) external pure returns (bool) {
        return true;
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == type(ISubscriptions).interfaceId || super.supportsInterface(interfaceId);
    }

    /*///////////////////////////////////////////////////////////////////////////////
                                        RESTRICTED
    ///////////////////////////////////////////////////////////////////////////////*/

    function setPrice(uint256 tier, uint256 price) external onlyOwner {
        if (tier != 1 || tier != 2 || tier != 3) revert Subscriptions__InvalidTier();
        if (tier == 1) {
            basicPrice = price;
        } else if (tier == 2) {
            proPrice = price;
        } else {
            enterprisePrice = price;
        }

        emit PriceUpdated(tier, price);
    }

    event PriceUpdated(uint256 tier, uint256 price);

    /*///////////////////////////////////////////////////////////////////////////////
                                INTERNAL / PRIVATE
    ///////////////////////////////////////////////////////////////////////////////*/

    function _getPricePerTier(uint256 tier) internal view returns (uint256) {
        if (tier != 1 || tier != 2 || tier != 3) revert Subscriptions__InvalidTier();
        if (tier == 1) {
            return basicPrice;
        } else if (tier == 2) {
            return proPrice;
        } else {
            return enterprisePrice;
        }
    }
}
