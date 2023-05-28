// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.18;

import {Context} from "@openzeppelin/contracts/utils/Context.sol";

import {PromoLib} from "../library/PromoLib.sol";
import {IMeedProgram} from "../interfaces/IMeedProgram.sol";
import {Errors} from "../utils/Errors.sol";

import {Collectibles} from "../promotions/Collectibles.sol";

/**
 * @title CollectiblesFactory
 * @author Pierre Estrabaud (@Pedrojok01)
 * @notice Part of the Meed Loyalty Platform from SuperUltra
 * @dev Contracts factory to deploy a Collectibles type promotion (ERC1155);
 *  - Allows brands to deploy a Collectibles campaign (Discount vouchers, Freebies, etc);
 *  - Deployer will receive NFT id 0, proving its ownership.
 */

contract CollectiblesFactory is Context, Errors {
    using PromoLib for PromoLib.Promotion;

    address private immutable CONTROL_ADDRESS; // Subscriptions contract address

    constructor(address _controlAddress) {
        CONTROL_ADDRESS = _controlAddress;
    }

    /*///////////////////////////////////////////////////////////////////////////////
                                        FACTORY
    ///////////////////////////////////////////////////////////////////////////////*/

    /**
     * @dev Call this function to create a new Collectibles promotion contract.
     * @param uri  URI of the promotions(user input).
     * @param startDate Date which mark the start of the promo;
     * @param endDate Date which mark the end of the promo;
     * @param meedProgram  MeedProgram address (user input).
     * @param _type  Type of the promotions to be created (user input).
     * - 4 = Stamps
     * - 5 = Paninis
     * @return newPromotion Instance of the newly created promotion.
     */
    function createNewPromotion(
        string[] memory uri,
        uint256 startDate,
        uint256 endDate,
        address meedProgram,
        PromoLib.PromotionsType _type
    ) external returns (address newPromotion) {
        if (_type != PromoLib.PromotionsType.Stamps && _type != PromoLib.PromotionsType.Paninis)
            revert CollectiblesFactory_TypeNotSupported();

        newPromotion = address(new Collectibles(uri, _msgSender(), startDate, endDate, meedProgram, CONTROL_ADDRESS));

        IMeedProgram program = IMeedProgram(meedProgram);
        program.addPromotion(newPromotion, _type, uint128(startDate), uint128(endDate));

        emit NewPromotionCreated(_msgSender(), newPromotion);
        return newPromotion;
    }

    event NewPromotionCreated(address indexed owner, address indexed newPromotion);
}
