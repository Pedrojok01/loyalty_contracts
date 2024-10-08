// SPDX-License-Identifier: BUSL-1.1
// solhint-disable no-unused-vars
pragma solidity ^0.8.20;

// import "hardhat/console.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";

import {Adminable} from "../utils/Adminable.sol";
import {PromoLib} from "../library/PromoLib.sol";
import {ILoyaltyProgram} from "../interfaces/ILoyaltyProgram.sol";
import {ICampaign} from "../interfaces/ICampaign.sol";
import {IStorage} from "../interfaces/IStorage.sol";

/**
 * @title LoyaltyProgram
 * @author @Pedrojok01
 * @notice Part of the Loyalty Platform
 * @dev ERC721 NFT with the following features:
 *  - Deployer can mint to recipients.
 */

// @todo
/**
 *  - Add identity proof to ensure only one NFT per person?
 *  - Send unique NFT/Badge to brands to recognise them
 */

contract LoyaltyProgram is ILoyaltyProgram, ERC721, ERC721Enumerable, Adminable {
  using PromoLib for PromoLib.Data;

  /*///////////////////////////////////////////////////////////////////////////////
                                        STORAGE
    ///////////////////////////////////////////////////////////////////////////////*/

  address private immutable SUBSCRIPTIONS_CONTRACT;
  bool public immutable TIER_TRACKER; // true = buyVolume (purchase Times), false = amountVolume
  string private _baseURIextended;
  uint40 private _tokenIdCounter;
  PromoLib.Data private promoLib;
  address[] private factories;
  bool public autoMintActivated = true; // Can automatically send vouchers if conditions are met;

  struct AutoReward {
    address promotion; // 20 bytes
    uint8 tokenId; // 1 byte
    uint8 levelRequired; // 1 byte
    uint32 amountRequired; // 4 bytes
  }

  mapping(uint8 => AutoReward) public autoRewards;

  struct TierStructure {
    uint64 silver;
    uint64 gold;
    uint64 platinum;
    uint64 diamond;
  }

  TierStructure private tierStructure;

  /**
   * @dev Store all data per member, fit in 1 storage slot
   */
  struct Membership {
    uint8 level; // 1 byte
    uint16 buyVolume; // 2 bytes (up to 65,535)
    uint32 amountVolume; // 4 bytes (up to 4,294,967,295)
    uint40 tokenId; // 5 bytes (up to 1,099,511,627,775)
    address owner; // 20 bytes
  }

  mapping(address => Membership) private membershipPerAddress;
  mapping(uint40 => Membership) private membershipPerTokenID;

  // Return true if the address is a promotion factory (to optimize onlyFactory modifier)
  mapping(address => bool) public isFactory;

  modifier onlyFactory() {
    _onlyFactory();
    _;
  }

  /**
   * @param _name Name of the new LoyaltyProgram (user input).
   * @param _symbol Symbol of the new LoyaltyProgram (user input).
   * @param _uri URI of the new LoyaltyProgram (user input).
   * @param _tierTracker  Determine how the tier structure is calculated:
   *  - true = based on purchase_times;
   *  - false = based on total_amount;
   * @param amounts  Amounts of either purchase_times or total_amount needed to climb each tier.
   */
  constructor(
    string memory _name,
    string memory _symbol,
    string memory _uri,
    bool _tierTracker,
    address _owner,
    uint64[4] memory amounts,
    address _storageAddress,
    address[] memory _factories
  ) ERC721(_name, _symbol) Adminable(_owner, _storageAddress) {
    // transferOwnership(_owner);
    SUBSCRIPTIONS_CONTRACT = IStorage(_storageAddress).getSubscriptionControl();
    TIER_TRACKER = _tierTracker;
    _baseURIextended = _uri;
    factories = _factories;

    for (uint256 i = 0; i < _factories.length; ) {
      isFactory[_factories[i]] = true;
      unchecked {
        i++;
      }
    }

    _initializeTierAndLimits(amounts[0], amounts[1], amounts[2], amounts[3]);

    mint(_owner);
  }

  /*///////////////////////////////////////////////////////////////////////////////
                                        WRITE
    /////////////////////////////////////////////////////////////////////////////*/

  /**
   * @dev External method for the owner  / admin to mint NFTs (enroll new member). Can only mint 1 per address.
   * @param to Address of the new member to be added.
   */
  function mint(address to) public onlyOwnerOrAdmin {
    _creditsCheck();
    _addMember(to);
  }

  function updateMember(address member, uint32 amountVolume) external onlyOwnerOrAdmin {
    if (amountVolume == 0) revert LoyaltyProgram__AmountVolumeIsZero();
    _creditsCheck();
    _updateMember(member, amountVolume);
  }

  /*///////////////////////////////////////////////////////////////////////////////
                                        VIEW
    /////////////////////////////////////////////////////////////////////////////*/

  function tokenURI(uint256 tokenId) public view override returns (string memory) {
    if (ownerOf(tokenId) != address(0)) return _baseURIextended;
  }

  function getTierStructure() external view returns (TierStructure memory) {
    return tierStructure;
  }

  function getMembershipPerAddress(address member) external view returns (Membership memory) {
    return membershipPerAddress[member];
  }

  function getMembershipPerTokenID(uint40 tokenId) external view returns (Membership memory) {
    return membershipPerTokenID[tokenId];
  }

  /**
   * @dev Allows to check if an address is a member
   */
  function isMember(address member) external view returns (bool) {
    return membershipPerAddress[member].owner == member;
  }

  /**
   * @dev Allows to get the level of a member
   */
  function getMemberLevel(address member) external view returns (uint8) {
    return membershipPerAddress[member].level;
  }

  function getAllPromotions() external view returns (PromoLib.Promotion[] memory allPromotions) {
    return PromoLib._getAllPromotions(promoLib);
  }

  function getAllPromotionsPerType(
    PromoLib.PromotionsType _type
  ) external view returns (PromoLib.Promotion[] memory) {
    uint256 totalPromotions = promoLib.promotions.length;

    PromoLib.Promotion[] memory promotionsPerType = new PromoLib.Promotion[](totalPromotions);
    uint256 count = 0;

    for (uint256 i = 0; i < totalPromotions; ) {
      if (promoLib.promotions[i].promotionsType == _type) {
        promotionsPerType[count] = promoLib.promotions[i];
        count++;
      }

      unchecked {
        i++;
      }
    }

    // Resize the promotionsPerType array to the correct size
    assembly {
      mstore(promotionsPerType, count)
    }
    return promotionsPerType;
  }

  /**
   * @dev Returns promotionsType (uint)
   * DiscountVouchers  - 0
   * FreeProducts - 1
   * VIPpass - 2
   * Badges  - 3
   * Stamps - 4
   * Paninis - 5
   * EventTickets - 6
   * Packs - 7
   */
  function getPromotionType(
    address promotion
  ) external view returns (PromoLib.PromotionsType _type) {
    return PromoLib._getPromotionType(promotion, promoLib);
  }

  function getPromotionStatus(address promotion) external view returns (bool _status) {
    return PromoLib._getPromotionStatus(promotion, promoLib);
  }

  /**
   * @dev Allows to get all promotions per status
   * @param status The status of the promotion:
   *  - true = active
   *  - false = inactive
   * @return activePromotions An array of promotions
   */
  function getAllPromotionsPerStatus(
    bool status
  ) external view returns (PromoLib.Promotion[] memory) {
    uint256 totalPromotions = promoLib.promotions.length;

    PromoLib.Promotion[] memory activePromotions = new PromoLib.Promotion[](totalPromotions);
    uint256 count = 0;

    if (status) {
      for (uint256 i = 0; i < totalPromotions; ) {
        if (_isPromotionActiveAndNotExpired(promoLib.promotions[i])) {
          activePromotions[count] = promoLib.promotions[i];
          count++;
        }

        unchecked {
          i++;
        }
      }
    }
    if (!status) {
      for (uint256 i = 0; i < totalPromotions; ) {
        if (!promoLib.promotions[i].active) {
          activePromotions[count] = promoLib.promotions[i];
          count++;
        }

        unchecked {
          i++;
        }
      }
    }

    // Resize the promotionsPerType array to the correct size
    assembly {
      mstore(activePromotions, count)
    }

    return activePromotions;
  }

  function supportsInterface(
    bytes4 interfaceId
  ) public view override(ERC721, ERC721Enumerable) returns (bool) {
    return super.supportsInterface(interfaceId);
  }

  /*///////////////////////////////////////////////////////////////////////////////
                                        RESTRICTED
    /////////////////////////////////////////////////////////////////////////////*/

  /**
   * @dev Allows to activate / deactivate the autoMint status;
   */
  function switchAutoMintStatus() external onlyOwnerOrAdmin {
    _creditsCheck();
    autoMintActivated = !autoMintActivated;
  }

  /**
   * @dev Updates the baseURI that will be used to retrieve NFT metadata.
   * @param baseURI_ The baseURI to be used.
   */
  function setBaseURI(string calldata baseURI_) external onlyOwnerOrAdmin {
    _creditsCheck();
    _baseURIextended = baseURI_;
  }

  /**
   * @dev Allows to add a promotion to the list of promotions (both array & mapping)
   * @param promotion The address of the loyalty program contract
   *
   * !!! CALLED FROM A PROMOTION FACTORY ONLY !!!
   */
  function addPromotion(
    address promotion,
    PromoLib.PromotionsType _type,
    uint256 _startDate,
    uint256 _endDate
  ) external onlyFactory {
    uint256 promoCount = promoLib.promotions.length;
    uint256 limit = _getCurrentPromotionLimit();

    // If promo limit reached, try to replace an expired promotion
    if (promoCount >= limit) {
      for (uint256 i = 0; i < promoCount; ) {
        if (!_isPromotionActiveAndNotExpired(promoLib.promotions[i])) {
          PromoLib._addPromotion(promotion, _type, _startDate, _endDate, promoLib);
          promoLib.promotionIndex[promotion] = i;

          delete promoLib.promotion[promoLib.promotions[i].promotionAddress];
          delete promoLib.promotionIndex[promoLib.promotions[i].promotionAddress];
          promoLib.promotions[i] = promoLib.promotion[promotion];
          return;
        }
        unchecked {
          i++;
        }
      }
      // If no expired promotions, revert
      revert LoyaltyProgram__PromotionLimitReached();
    } else {
      // If not reached the limit, just add the new promotion
      PromoLib._addPromotion(promotion, _type, _startDate, _endDate, promoLib);
    }
  }

  function addAutoMintReward(
    uint8 level,
    address promotion,
    uint8 tokenId,
    uint32 amountRequired
  ) external onlyOwnerOrAdmin {
    _creditsCheck();
    if (level == 0 || level > 5) revert LoyaltyProgram__LevelOutOfRange(); // max enum value of level
    AutoReward memory newReward = AutoReward(promotion, tokenId, level, amountRequired);
    autoRewards[level] = newReward;

    emit AutoRewardAdded(level, promotion, tokenId, amountRequired);
  }

  event AutoRewardAdded(uint8 level, address promotion, uint8 tokenId, uint32 amountRequired);

  function removeAutoMintReward(uint8 level) external onlyOwnerOrAdmin {
    _creditsCheck();
    if (level == 0 || level > 5) revert LoyaltyProgram__LevelOutOfRange();
    delete autoRewards[level];
  }

  /**
   * @dev Allows to activate a promotion
   */
  function activatePromotion(address promoAddress) public onlyOwnerOrAdmin {
    _creditsCheck();
    PromoLib._setPromotionStatus(promoAddress, false, promoLib);
    ICampaign(promoAddress).activatePromotion();
  }

  /**
   * @dev Allows to deactivate a promotion
   */
  function deactivatePromotion(address promoAddress) public onlyOwnerOrAdmin {
    _creditsCheck();
    PromoLib._setPromotionStatus(promoAddress, false, promoLib);
    ICampaign(promoAddress).deactivatePromotion();
  }

  /*///////////////////////////////////////////////////////////////////////////////
                                    INTERNAL / PRIVATE
    /////////////////////////////////////////////////////////////////////////////*/

  function _initializeTierAndLimits(
    uint64 _amount1,
    uint64 _amount2,
    uint64 _amount3,
    uint64 _amount4
  ) private {
    tierStructure = TierStructure({
      silver: _amount1,
      gold: _amount2,
      platinum: _amount3,
      diamond: _amount4
    });
  }

  function _addMember(address to) private {
    if (membershipPerAddress[to].level != 0) {
      revert LoyaltyProgram__AlreadyMember();
    }

    uint40 tokenId = _tokenIdCounter;
    _tokenIdCounter++;

    Membership memory newMembership = Membership({
      level: 1,
      buyVolume: 0,
      amountVolume: 0,
      tokenId: tokenId,
      owner: to
    });
    membershipPerAddress[to] = newMembership;
    membershipPerTokenID[tokenId] = newMembership;

    _safeMint(to, tokenId);
  }

  function _updateMember(address member, uint32 purchasedAmount) private {
    if (membershipPerAddress[member].level == 0) {
      mint(member);
    }

    Membership memory memberData = membershipPerAddress[member];

    memberData.buyVolume++;
    memberData.amountVolume += purchasedAmount;

    membershipPerAddress[member] = memberData;
    membershipPerTokenID[memberData.tokenId] = memberData;

    if (memberData.level != 5) {
      _updateMemberLevel(member, memberData);
    }

    if (autoMintActivated) {
      // Fetch the best-fit reward according to the member's level and purchased amount.
      AutoReward memory bestFitReward = getBestFitReward(memberData.level, purchasedAmount);

      // If a suitable reward exists
      if (bestFitReward.promotion != address(0)) {
        ICampaign iCampaign = ICampaign(bestFitReward.promotion);
        iCampaign.autoMint(bestFitReward.tokenId, member);
      }
    }
  }

  function _updateMemberLevel(address _member, Membership memory _memberData) private {
    uint8 currentLevel = _memberData.level;
    uint8 newLevel;
    uint32 currentVolume = TIER_TRACKER ? uint32(_memberData.buyVolume) : _memberData.amountVolume;

    if (currentVolume >= tierStructure.diamond) {
      newLevel = 5;
    } else if (currentVolume >= tierStructure.platinum) {
      newLevel = 4;
    } else if (currentVolume >= tierStructure.gold) {
      newLevel = 3;
    } else if (currentVolume >= tierStructure.silver) {
      newLevel = 2;
    } else newLevel = currentLevel;

    if (newLevel != currentLevel) {
      _updateMemberLevelInternal(_member, newLevel, _memberData.tokenId);
    }
  }

  function _updateMemberLevelInternal(address _member, uint8 _newLevel, uint40 _tokenId) private {
    membershipPerAddress[_member].level = _newLevel;
    membershipPerTokenID[_tokenId].level = _newLevel;
    emit LevelUpdated(_member, _newLevel);
  }

  event LevelUpdated(address indexed member, uint8 level);

  function _getCurrentPromotionLimit() private returns (uint256) {
    (bool success, bytes memory data) = SUBSCRIPTIONS_CONTRACT.call(
      abi.encodeWithSignature("getCurrentPromotionLimit(address)", owner())
    );

    if (!success) revert LoyaltyProgram__GetCurrentPromotionLimitFailed();
    return abi.decode(data, (uint256));
  }

  function getBestFitReward(uint8 level, uint32 amount) public view returns (AutoReward memory) {
    AutoReward memory bestFitReward = autoRewards[level];
    if (amount >= bestFitReward.amountRequired) {
      return bestFitReward;
    } else {
      return AutoReward(address(0), 0, 0, 0); // return a dummy reward
    }
  }

  function _baseURI() internal view override returns (string memory) {
    return _baseURIextended;
  }

  function _onlyFactory() private view {
    if (!isFactory[_msgSender()]) revert LoyaltyProgram__AuthorizedFactoryOnly();
  }

  function _creditsCheck() private {
    if (_msgSender() == admin()) {
      (bool success, bytes memory result) = SUBSCRIPTIONS_CONTRACT.call(
        abi.encodeWithSignature("getUserCredits(address)", owner())
      );
      if (!success || abi.decode(result, (uint256)) < 1) {
        revert Credits__InsufficientCredits();
      } else {
        (bool removalSuccess, ) = SUBSCRIPTIONS_CONTRACT.call(
          abi.encodeWithSignature("_autoRemoveUserCredits(address)", owner())
        );
        if (!removalSuccess) revert Credits__ErrorWhileRemovingCredit();
      }
    }
  }

  function _isPromotionActiveAndNotExpired(
    PromoLib.Promotion memory promo
  ) private view returns (bool) {
    return promo.active && (promo.endDate > block.timestamp || promo.endDate == 0);
  }

  /**
   * @dev Needed in new OpenZeppelin v5 implementation
   * See {ERC721-_increaseBalance}. We need that to account tokens that were minted in batch
   */
  function _increaseBalance(
    address account,
    uint128 amount
  ) internal override(ERC721, ERC721Enumerable) {
    if (amount > 0) {
      revert ERC721EnumerableForbiddenBatchMint();
    }
    super._increaseBalance(account, amount);
  }

  /**
   * @dev Needed in new OpenZeppelin v5 implementation
   * @dev See {ERC721-_update}.
   */
  function _update(
    address to,
    uint256 tokenId,
    address auth
  ) internal override(ERC721, ERC721Enumerable) returns (address) {
    return super._update(to, tokenId, auth);
  }
}
