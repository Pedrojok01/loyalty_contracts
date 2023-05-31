// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.18;

import {Context} from "@openzeppelin/contracts/utils/Context.sol";

import {PromoLib} from "../library/PromoLib.sol";
import {IMeedProgram} from "../interfaces/IMeedProgram.sol";
import {Errors} from "../utils/Errors.sol";
import {AdminRegistry} from "../subscriptions/AdminRegistry.sol";

import {Redeemable} from "../promotions/Redeemable.sol";

/**
 * @title RedeemableFactory
 * @author Pierre Estrabaud (@Pedrojok01)
 * @notice Part of the Meed Loyalty Platform from SuperUltra
 * @dev Contracts factory to deploy a Redeemable promotion (ERC1155);
 *  - Allows brands to deploy a redeemable campaign (Discount vouchers, Freebies, etc).
 *  - Deployer will receive NFT id 0, proving its ownership.
 */

contract RedeemableFactory is Context, Errors {
  using PromoLib for PromoLib.Promotion;

  address private immutable CONTROL_ADDRESS; // Subscriptions contract address
  address private _adminRegistry;

  constructor(address _controlAddress, address adminRegistryAddress) {
    CONTROL_ADDRESS = _controlAddress;
    _adminRegistry = adminRegistryAddress;
  }

  /*///////////////////////////////////////////////////////////////////////////////
                                        FACTORY
    ///////////////////////////////////////////////////////////////////////////////*/

  /**
   * @dev Call this function to create a new Redeemable promotion contract.
   * @param uri  URI of the new MeedProgram (user input).
   * @param startDate Date which mark the start of the promo;
   * @param endDate Date which mark the end of the promo;
   * @param meedProgram  MeedProgram address (user input).
   * @param _type  Type of the promotions to be created (user input).
   * - 0 = DiscountVouchers
   * - 1 = FreeProducts
   * @return newPromotion Instance of the newly created promotion.
   */
  function createNewPromotion(
    string memory uri,
    uint256 startDate,
    uint256 endDate,
    address meedProgram,
    PromoLib.PromotionsType _type
  ) external returns (address newPromotion) {
    if (
      _type != PromoLib.PromotionsType.DiscountVouchers &&
      _type != PromoLib.PromotionsType.FreeProducts
    ) revert RedeemableFactory_TypeNotSupported();

    newPromotion = address(
      new Redeemable(
        uri,
        _msgSender(),
        startDate,
        endDate,
        meedProgram,
        CONTROL_ADDRESS,
        _adminRegistry
      )
    );

    IMeedProgram program = IMeedProgram(meedProgram);
    program.addPromotion(newPromotion, _type, uint128(startDate), uint128(endDate));

    emit NewPromotionCreated(_msgSender(), newPromotion);
    return newPromotion;
  }

  event NewPromotionCreated(address indexed owner, address indexed newPromotion);
}
