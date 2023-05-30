// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.18;

import {Context} from "@openzeppelin/contracts/utils/Context.sol";

import {PromoLib} from "../library/PromoLib.sol";
import {IMeedProgram} from "../interfaces/IMeedProgram.sol";
import {Errors} from "../utils/Errors.sol";

import {NonExpirable} from "../promotions/NonExpirable.sol";

/**
 * @title NonExpirableFactory
 * @author Pierre Estrabaud (@Pedrojok01)
 * @notice Part of the Meed Loyalty Platform from SuperUltra
 * @dev Contracts factory to deploy a NonExpirable promotion (ERC721);
 *  - Allows brands to deploy a NonExpirable campaign (Badge, VIP/MVP pass, etc..);
 *  - Deployer will receive NFT id 0, proving its ownership.
 *  - Stores all brand details into the Brand struct (allows filters)
 */

contract NonExpirableFactory is Context, Errors {
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
     * @dev Call this function to create a new NonExpirable promotion contract.
     * @param name  Name of the new MeedProgram (user input).
     * @param symbol  Symbol of the new MeedProgram (user input).
     * @param uri  URI of the promotions(user input).
     * @param meedProgram  MeedProgram address (user input).
     * @param data Data of the new MeedProgram (user input) - expirationDate.
     * @param _type  Type of the promotions to be created (user input).
     * - 2 = VIPpass
     * - 3 = Badges
     * @return newPromotion Instance of the newly created promotion.
     */
    function createNewPromotion(
        string memory name,
        string memory symbol,
        string memory uri,
        address meedProgram,
        uint256 data,
        PromoLib.PromotionsType _type
    ) external returns (address newPromotion) {
        if (_type != PromoLib.PromotionsType.VIPpass && _type != PromoLib.PromotionsType.Badges)
            revert NonExpirableFactory_TypeNotSupported();

        newPromotion = address(
            new NonExpirable(name, symbol, uri, _msgSender(), data, meedProgram, CONTROL_ADDRESS, _adminRegistry)
        );

        IMeedProgram program = IMeedProgram(meedProgram);
        program.addPromotion(newPromotion, _type, uint128(block.timestamp), 0);

        emit NewPromotionCreated(_msgSender(), newPromotion, name);
        return newPromotion;
    }

    event NewPromotionCreated(address owner, address indexed newPromotion, string newPromotionName);
}
