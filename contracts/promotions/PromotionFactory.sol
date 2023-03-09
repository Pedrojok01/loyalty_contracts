// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.18;

import {Context} from "@openzeppelin/contracts/utils/Context.sol";

import {PromoLib} from "../library/PromoLib.sol";
import {ILoyaltyProgram} from "../interfaces/ILoyaltyProgram.sol";
import {Errors} from "../utils/Errors.sol";

import {Redeemable} from "../promotions/Redeemable.sol";
import {Expirable} from "../promotions/Expirable.sol";

/**
 * @title PromotionFactory
 * @author Pierre Estrabaud (@Pedrojok01)
 * @notice Part of the Meed Rewards platform from SuperUltra
 * @dev Contracts factory do deploy the LoyaltyProgram Soulbound ERC721;
 *  - Deployer can launch its own Membership program.
 *  - Deployer will receive NFT id 0, proving its ownership.
 *  - Stores all brand details into the Brand struct (allows filters)
 */

contract PromotionFactory is Context, Errors {
    using PromoLib for PromoLib.Promotion;

    /*///////////////////////////////////////////////////////////////////////////////
                                        FACTORY
    ///////////////////////////////////////////////////////////////////////////////*/

    /**
     * @dev Call this function to create a new LoyaltyProgram contract.
     * @param name  Name of the new LoyaltyProgram (user input).
     * @param symbol  Symbol of the new LoyaltyProgram (user input).
     * @param uri  URI of the new LoyaltyProgram (user input).
     * @param data Data of the new LoyaltyProgram (user input).
     * @param loyaltyProgram  LoyaltyProgram address (user input).
     * @param _type  Type of the promotions to be created (user input).
     * @return newPromotion Instance of the newly created promotion.
     */
    function createNewPromotion(
        string memory name,
        string memory symbol,
        string memory uri,
        uint256 data,
        address loyaltyProgram,
        PromoLib.PromotionsType _type
    ) external returns (address newPromotion) {
        if (_type == PromoLib.PromotionsType.Vouchers || _type == PromoLib.PromotionsType.FreeProducts) {
            newPromotion = address(new Redeemable(uri, _msgSender(), data, loyaltyProgram));
        } else if (_type == PromoLib.PromotionsType.EventTickets || _type == PromoLib.PromotionsType.SeasonPass) {
            newPromotion = address(new Expirable(name, symbol, uri, _msgSender(), data, loyaltyProgram));
        } else {
            revert PromotionFactory_TypeNotSupported();
        }

        ILoyaltyProgram program = ILoyaltyProgram(loyaltyProgram);
        program.addPromotion(newPromotion, _type);

        emit NewLoyaltyCreated(_msgSender(), newPromotion, name);
        return newPromotion;
    }

    event NewLoyaltyCreated(address owner, address indexed newPromotion, string newPromotionName);
}
