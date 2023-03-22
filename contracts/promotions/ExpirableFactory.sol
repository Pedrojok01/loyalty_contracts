// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.18;

import {Context} from "@openzeppelin/contracts/utils/Context.sol";

import {PromoLib} from "../library/PromoLib.sol";
import {IMeedProgram} from "../interfaces/IMeedProgram.sol";
import {Errors} from "../utils/Errors.sol";

import {Expirable} from "../promotions/Expirable.sol";

/**
 * @title ExpirableFactory
 * @author Pierre Estrabaud (@Pedrojok01)
 * @notice Part of the Meed Rewards platform from SuperUltra
 * @dev Contracts factory to deploy an expirable type of promotion;
 *  - Deployer can launch its own Membership program.
 *  - Deployer will receive NFT id 0, proving its ownership.
 *  - Stores all brand details into the Brand struct (allows filters)
 */

contract ExpirableFactory is Context, Errors {
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
     * @param data Data of the new MeedProgram (user input) - expirationDate.
     * @param meedProgram  MeedProgram address (user input).
     * @param _type  Type of the promotions to be created (user input).
     * @return newPromotion Instance of the newly created promotion.
     */
    function createNewPromotion(
        string memory name,
        string memory symbol,
        string memory uri,
        uint256 data,
        address meedProgram,
        PromoLib.PromotionsType _type
    ) external returns (address newPromotion) {
        if (_type != PromoLib.PromotionsType.EventTickets && _type != PromoLib.PromotionsType.VIPpass)
            revert ExpirableFactory_TypeNotSupported();

        newPromotion = address(new Expirable(name, symbol, uri, _msgSender(), data, meedProgram, CONTROL_ADDRESS));

        IMeedProgram program = IMeedProgram(meedProgram);
        program.addPromotion(newPromotion, _type);

        emit NewPromotionCreated(_msgSender(), newPromotion, name);
        return newPromotion;
    }

    event NewPromotionCreated(address owner, address indexed newPromotion, string newPromotionName);
}
