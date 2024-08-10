// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.20;

import {Context} from "@openzeppelin/contracts/utils/Context.sol";

import {PromoLib} from "../library/PromoLib.sol";
import {ILoyaltyProgram} from "../interfaces/ILoyaltyProgram.sol";
import {Errors} from "../utils/Errors.sol";

import {NonExpirable} from "../campaigns/NonExpirable.sol";

/**
 * @title NonExpirableFactory
 * @author @Pedrojok01
 * @notice Part of the Loyalty Platform
 * @dev Contracts factory to deploy a NonExpirable promotion (ERC721);
 *  - Allows brands to deploy a NonExpirable campaign (Badge, VIP/MVP pass, etc..);
 *  - Deployer will receive NFT id 0, proving its ownership.
 *  - Stores all brand details into the Brand struct (allows filters)
 */

contract NonExpirableFactory is Context, Errors {
  using PromoLib for PromoLib.Promotion;

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
   * @dev Call this function to create a new NonExpirable promotion contract.
   * @param name  Name of the new LoyaltyProgram (user input).
   * @param symbol  Symbol of the new LoyaltyProgram (user input).
   * @param uri  URI of the promotions(user input).
   * @param loyaltyProgram  LoyaltyProgram address (user input).
   * @param data Data of the new LoyaltyProgram (user input) - expirationDate.
   * @param _type  Type of the promotions to be created (user input).
   * - 2 = VIPpass
   * - 3 = Badges
   * @return newPromotion Instance of the newly created promotion.
   */
  function createNewPromotion(
    string memory name,
    string memory symbol,
    string memory uri,
    address loyaltyProgram,
    uint256 data,
    PromoLib.PromotionsType _type
  ) external returns (address newPromotion) {
    if (_type != PromoLib.PromotionsType.VIPpass && _type != PromoLib.PromotionsType.Badges)
      revert NonExpirableFactory_TypeNotSupported();

    newPromotion = address(
      new NonExpirable(name, symbol, uri, _msgSender(), data, loyaltyProgram, _storage)
    );

    ILoyaltyProgram program = ILoyaltyProgram(loyaltyProgram);
    program.addPromotion(newPromotion, _type, uint128(block.timestamp), 0);

    emit NewPromotionCreated(_msgSender(), newPromotion, name);
    return newPromotion;
  }

  event NewPromotionCreated(address owner, address indexed newPromotion, string newPromotionName);
}
