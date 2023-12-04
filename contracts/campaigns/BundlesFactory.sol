// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.20;

import {Context} from "@openzeppelin/contracts/utils/Context.sol";

import {PromoLib} from "../library/PromoLib.sol";
import {CampaignDataLib} from "../library/CampaignDataLib.sol";
import {Errors} from "../utils/Errors.sol";
import {ILoyaltyProgram} from "../interfaces/ILoyaltyProgram.sol";

import {Bundles} from "../campaigns/Bundles.sol";

/**
 * @title BundlesFactory
 * @author Pierre Estrabaud (@Pedrojok01)
 * @notice Part of the Loyalty Platform
 * @dev Contracts factory to deploy a Bundles type promotion (ERC721);
 *  - Allows brands to deploy a Bundles campaign (Mystery Packs).
 *  - Deployer will receive NFT id 0, proving its ownership.
 *  - Stores all brand details into the Brand struct (allows filters)
 */

contract BundlesFactory is Context, Errors {
  using PromoLib for PromoLib.Promotion;
  using CampaignDataLib for CampaignDataLib.BundlesPromoData;

  // address private immutable CONTROL_ADDRESS; // Subscriptions contract address
  // address private _adminRegistry;
  address private _storage;

  constructor(address storage_) {
    _storage = storage_;
  }

  /*///////////////////////////////////////////////////////////////////////////////
                                        FACTORY
    ///////////////////////////////////////////////////////////////////////////////*/

  /**
   * @dev Call this function to create a new Bundles promotion contract.
   * @param name  Name of the new LoyaltyProgram (user input).
   * @param symbol  Symbol of the new LoyaltyProgram (user input).
   * @param uri  URI of the promotions(user input).
   * @param loyaltyProgram  LoyaltyProgram address (user input).
   * @param startDate Date which mark the start of the promo;
   * @param endDate Date which mark the end of the promo;
   * @param maxLimit Max bundles supply (user input) - Max supply (0 = unlimited).
   * @param _type  Type of products sold (user input).
   * - 7 = Bundles
   * @return newPromotion Instance of the newly created promotion.
   */
  function createNewPromotion(
    string memory name,
    string memory symbol,
    string memory uri,
    address loyaltyProgram,
    uint256 startDate,
    uint256 endDate,
    uint256 maxLimit,
    PromoLib.PromotionsType _type
  ) external returns (address newPromotion) {
    if (_type != PromoLib.PromotionsType.Packs) revert BundlesFactory_TypeNotSupported();

    CampaignDataLib.BundlesPromoData memory data = CampaignDataLib.BundlesPromoData({
      _startDate: startDate,
      _expirationDate: endDate,
      _maxLimit: maxLimit,
      _loyaltyProgram: loyaltyProgram,
      _owner: _msgSender()
    });

    newPromotion = address(new Bundles(name, symbol, uri, data, _storage));

    ILoyaltyProgram program = ILoyaltyProgram(loyaltyProgram);
    program.addPromotion(newPromotion, _type, uint128(startDate), uint128(endDate));

    emit NewPromotionCreated(_msgSender(), newPromotion, name);
    return newPromotion;
  }

  event NewPromotionCreated(address owner, address indexed newPromotion, string newPromotionName);
}
