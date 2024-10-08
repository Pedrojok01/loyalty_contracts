// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.20;

import {PromoLib} from "../library/PromoLib.sol";

/**
 * @title Interface for LoyaltyProgram.sol contract;
 * @author @Pedrojok01
 * @notice Part of the Loyalty Platform
 * @dev Allows the Loyalty factory to deploy new loyalty contracts;
 */

interface ILoyaltyProgram {
  /**
   * @dev An external method for the owner to mint Soulbound NFTs. Can only mint 1 per address.
   */
  function mint(address to) external;

  function isMember(address member) external view returns (bool);

  // Declare a function to get the level of an NFT
  function getMemberLevel(address user) external view returns (uint8);

  function getAllPromotions() external view returns (PromoLib.Promotion[] memory allPromotions);

  function getAllPromotionsPerType(
    PromoLib.PromotionsType _type
  ) external view returns (PromoLib.Promotion[] memory promotionsPerType);

  function getAllPromotionsPerStatus(
    bool status
  ) external view returns (PromoLib.Promotion[] memory activePromotions);

  /**
   * @dev Updates the baseURI that will be used to retrieve NFT metadata.
   * @param baseURI_ The baseURI to be used.
   */
  function setBaseURI(string calldata baseURI_) external;

  function addPromotion(
    address contractAddress,
    PromoLib.PromotionsType _type,
    uint256 _startDate,
    uint256 _endDate
  ) external;
}
