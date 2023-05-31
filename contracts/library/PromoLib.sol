// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.18;

/**
 * @title PromoLib
 * @author Pierre Estrabaud (@Pedrojok01)
 * @notice Part of the Meed Loyalty Platform from SuperUltra
 * @dev Provides safe getter and setter for promotion status and type.
 *
 * Include with `using PromoLib for PromoLib.Promotion;`
 */

library PromoLib {
  enum PromotionsType {
    DiscountVouchers, // Redeemable
    FreeProducts, // Redeemable
    VIPpass, //NonExpirable
    Badges, //NonExpirable
    Stamps, // Collectible
    Paninis, // Collectible
    EventTickets, // Ticketable
    Packs // Bundle
  }

  struct Promotion {
    uint40 startDate;
    uint40 endDate;
    address promotionAddress;
    bool active;
    PromotionsType promotionsType;
  }

  struct Data {
    mapping(address => Promotion) promotion; // Allows to get a promotion by its address
    mapping(address => uint256) promotionIndex; // Keet track of the index of the promotion in the array
    Promotion[] promotions; // Array of all the promotions per MeedProgram
  }

  /*///////////////////////////////////////////////////////////////////////////////
                                        SETTERS
    ///////////////////////////////////////////////////////////////////////////////*/

  /**
   * @dev Add a new promotion to the array of promotions within the MeedProgram
   * @param _promotion  The address of the promotion
   * @param _type  The type of the promotion
   */
  function _addPromotion(
    address _promotion,
    PromoLib.PromotionsType _type,
    uint256 _startDate,
    uint256 _endDate,
    Data storage self
  ) internal {
    Promotion memory newPromotion = PromoLib.Promotion({
      startDate: uint40(_startDate),
      endDate: uint40(_endDate),
      promotionAddress: _promotion,
      active: true,
      promotionsType: PromoLib.PromotionsType(_type)
    });

    self.promotion[_promotion] = newPromotion;
    self.promotions.push(newPromotion);
    self.promotionIndex[_promotion] = self.promotions.length - 1;
  }

  /**
   * @dev Update promotionsStatus by passing bool into input
   * @param _promotion The address of the promotion
   * @param _status The status of the promotion
   */
  function _setPromotionStatus(address _promotion, bool _status, Data storage self) internal {
    self.promotion[_promotion].active = _status;
    self.promotions[self.promotionIndex[_promotion]].active = _status;
  }

  /*///////////////////////////////////////////////////////////////////////////////
                                        GETTERS
    ///////////////////////////////////////////////////////////////////////////////*/

  function _getAllPromotions(Data storage self) internal view returns (Promotion[] memory) {
    return self.promotions;
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
  function _getPromotionType(
    address _promotion,
    Data storage self
  ) internal view returns (PromotionsType) {
    return self.promotion[_promotion].promotionsType;
  }

  /**
   * @dev Returns promotions status (bool)
   * active = true
   * inactive = false
   */
  function _getPromotionStatus(address _promotion, Data storage self) internal view returns (bool) {
    return self.promotion[_promotion].active;
  }
}
