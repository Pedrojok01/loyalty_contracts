// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.18;

import {Context} from "@openzeppelin/contracts/utils/Context.sol";

import {PromoLib} from "../library/PromoLib.sol";
import {Errors} from "../utils/Errors.sol";
import {ILoyaltyProgram} from "../interfaces/ILoyaltyProgram.sol";

import {Bundles} from "../promotions/Bundles.sol";

/**
 * @title BundlesFactory
 * @author Pierre Estrabaud (@Pedrojok01)
 * @notice Part of the Meed Rewards platform from SuperUltra
 * @dev Contracts factory do deploy the LoyaltyProgram Soulbound ERC721;
 *  - Deployer can launch its own Membership program.
 *  - Deployer will receive NFT id 0, proving its ownership.
 *  - Stores all brand details into the Brand struct (allows filters)
 */

contract BundlesFactory is Context, Errors {
    using PromoLib for PromoLib.Promotion;

    /*///////////////////////////////////////////////////////////////////////////////
                                        FACTORY
    ///////////////////////////////////////////////////////////////////////////////*/

    /**
     * @dev Call this function to create a new LoyaltyProgram contract.
     * @param name  Name of the new LoyaltyProgram (user input).
     * @param symbol  Symbol of the new LoyaltyProgram (user input).
     * @param uri  URI of the new LoyaltyProgram (user input).
     * * @param data Data of the new LoyaltyProgram (user input).
     * @param loyaltyProgram  LoyaltyProgram address (user input).
     * @param _type  Type of products sold (user input).
     * @return newPromotion Instance of the newly created promotion.
     */
    function createNewPromotion(
        string memory name,
        string memory symbol,
        string memory uri,
        uint256 expirationDate,
        address loyaltyProgram,
        uint256 data,
        PromoLib.PromotionsType _type
    ) external returns (address newPromotion) {
        if (_type == PromoLib.PromotionsType.Bundles || _type == PromoLib.PromotionsType.Stamps) {
            newPromotion = address(new Bundles(name, symbol, uri, expirationDate, loyaltyProgram, data, _msgSender()));
        } else {
            revert BundlesFactory_TypeNotSupported();
        }

        ILoyaltyProgram program = ILoyaltyProgram(loyaltyProgram);
        program.addPromotion(newPromotion, _type);

        emit NewLoyaltyCreated(_msgSender(), newPromotion, name);
        return newPromotion;
    }

    event NewLoyaltyCreated(address owner, address indexed newPromotion, string newPromotionName);
}
