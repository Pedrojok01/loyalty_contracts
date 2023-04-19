// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.18;

import {Context} from "@openzeppelin/contracts/utils/Context.sol";

import {PromoLib} from "../library/PromoLib.sol";
import {Errors} from "../utils/Errors.sol";
import {IMeedProgram} from "../interfaces/IMeedProgram.sol";

import {Bundles} from "../promotions/Bundles.sol";

/**
 * @title BundlesFactory
 * @author Pierre Estrabaud (@Pedrojok01)
 * @notice Part of the Meed Rewards platform from SuperUltra
 * @dev Contracts factory do deploy the MeedProgram Soulbound ERC721;
 *  - Deployer can launch its own Membership program.
 *  - Deployer will receive NFT id 0, proving its ownership.
 *  - Stores all brand details into the Brand struct (allows filters)
 */

contract BundlesFactory is Context, Errors {
    using PromoLib for PromoLib.Promotion;

    address private immutable CONTROL_ADDRESS;

    constructor(address _controlAddress) {
        CONTROL_ADDRESS = _controlAddress;
    }

    /*///////////////////////////////////////////////////////////////////////////////
                                        FACTORY
    ///////////////////////////////////////////////////////////////////////////////*/

    /**
     * @dev Call this function to create a new MeedProgram contract.
     * @param name  Name of the new MeedProgram (user input).
     * @param symbol  Symbol of the new MeedProgram (user input).
     * @param uri  URI of the new MeedProgram (user input).
     * @param data Data of the new MeedProgram (user input) - Max supply (0 = unlimited).
     * @param meedProgram  MeedProgram address (user input).
     * @param _type  Type of products sold (user input).
     * @return newPromotion Instance of the newly created promotion.
     */
    function createNewPromotion(
        string memory name,
        string memory symbol,
        string memory uri,
        uint256 data2, //start Date
        uint256 expirationDate,
        address meedProgram,
        uint256 data,
        PromoLib.PromotionsType _type
    ) external returns (address newPromotion) {
        if (_type != PromoLib.PromotionsType.Bundles) revert BundlesFactory_TypeNotSupported();

        newPromotion = address(
            new Bundles(name, symbol, uri, data2, expirationDate, meedProgram, data, _msgSender(), CONTROL_ADDRESS)
        );

        IMeedProgram program = IMeedProgram(meedProgram);
        program.addPromotion(newPromotion, _type);

        emit NewPromotionCreated(_msgSender(), newPromotion, name);
        return newPromotion;
    }

    event NewPromotionCreated(address owner, address indexed newPromotion, string newPromotionName);
}
