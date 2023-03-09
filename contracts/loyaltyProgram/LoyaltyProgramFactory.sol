// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.18;

import {Context} from "@openzeppelin/contracts/utils/Context.sol";

import {ILoyaltyProgram} from "../interfaces/ILoyaltyProgram.sol";
import {LoyaltyProgram} from "./LoyaltyProgram.sol";
import {Errors} from "../utils/Errors.sol";

/**
 * @title LoyaltyProgramFactory
 * @author Pedrojok01
 * @notice Part of the Loyal-T platform from SuperUltra
 * @dev Contracts factory do deploy the LoyaltyProgram Soulbound ERC721;
 *  - Deployer can launch its own Membership program.
 *  - Deployer will receive NFT id 0, proving its ownership.
 *  - Stores all brand details into the Brand struct (allows filters)
 */

/**
 * Sighash   |   Function Signature
 * ================================
 * 0e4076e7  =>  createNewLoyaltyProgram(string,string,string,bytes16,bytes16)
 * 8a61cb3f  =>  getLoyaltyProgramPerIndex(uint256)
 * 8372de9e  =>  getNumberOfLoyaltyProgram()
 * 3f3c9b69  =>  _createNewLoyaltyProgram(uint256,string,string,string,bytes16,bytes16)
 */

contract LoyaltyProgramFactory is Context, Errors {
    /*///////////////////////////////////////////////////////////////////////////////
                                        STORAGE
    ///////////////////////////////////////////////////////////////////////////////*/

    /**
     * @dev Main brand details to allow:
     * - For filters in UI/UX;
     * - To quickly get all LoyaltyProgram per address;
     */
    struct Brand {
        bytes16 productType;
        bytes16 location;
        address owner;
    }

    /**
     * @notice Map all loyalty IDs per owner;
     */
    mapping(address => uint256[]) public getLoyaltyIDPerOwner;

    /**
     * @notice Map all loyalty IDs per name;
     */
    mapping(string => uint256) public getLoyaltyIDPerName;

    /**
     * @notice Map all loyalty addresses per ID;
     */
    mapping(uint256 => ILoyaltyProgram) public getLoyaltyAddress;

    /**
     * @notice Map all brands details per ID;
     */
    mapping(uint256 => Brand) public brands;

    /**
     * @notice Array containing all created LoyaltyProgram addresses;
     */
    ILoyaltyProgram[] public loyaltyList;

    /*///////////////////////////////////////////////////////////////////////////////
                                        FACTORY
    ///////////////////////////////////////////////////////////////////////////////*/

    /**
     * @dev Call this function to create a new LoyaltyProgram contract.
     * @param name  Name of the new LoyaltyProgram (user input).
     * @param symbol  Symbol of the new LoyaltyProgram (user input).
     * @param uri  URI of the new LoyaltyProgram (user input).
     * @param productType  Type of products sold (user input).
     * @param location  Store location, in case of regional stores (user input).
     * @return newLoyalty Instance of the newly created contract.
     */
    function createNewLoyaltyProgram(
        string memory name,
        string memory symbol,
        string memory uri,
        bool tierTracker,
        uint64[4] memory amounts,
        bytes16 productType,
        bytes16 location
    ) external returns (ILoyaltyProgram newLoyalty) {
        uint256 loyaltyID = loyaltyList.length;

        if (getLoyaltyAddress[loyaltyID] != ILoyaltyProgram(address(0))) {
            revert LoyaltyProgramFactory_AlreadyExists();
        }

        return _createNewLoyaltyProgram(loyaltyID, name, symbol, uri, tierTracker, amounts, productType, location);
    }

    event NewLoyaltyCreated(
        address owner,
        ILoyaltyProgram indexed newLoyaltyAddress,
        uint256 indexed newLoyaltyID,
        string newLoyaltyName
    );

    /*///////////////////////////////////////////////////////////////////////////////
                                    VIEW FUNCTIONS
    ///////////////////////////////////////////////////////////////////////////////*/

    /**
     * @dev Returs a LoyaltyProgram instance from an Id;
     * @param loyaltyId Id of the instance to look for;
     * @return loyaltyId Instance of the contract matching the loyaltyId;
     */
    function getLoyaltyProgramPerIndex(uint256 loyaltyId) external view returns (ILoyaltyProgram) {
        return loyaltyList[loyaltyId];
    }

    /**
     * @dev Returs the amount of LoyaltyProgram created so far;
     */
    function getNumberOfLoyaltyProgram() external view returns (uint256) {
        return loyaltyList.length - 1;
    }

    /*///////////////////////////////////////////////////////////////////////////////
                                    PRIVATE FUNCTIONS
    ///////////////////////////////////////////////////////////////////////////////*/

    function _createNewLoyaltyProgram(
        uint256 _loyaltyID,
        string memory _name,
        string memory _symbol,
        string memory _uri,
        bool _tierTracker,
        uint64[4] memory amounts,
        bytes16 _productType,
        bytes16 _location
    ) private returns (ILoyaltyProgram newLoyalty) {
        address owner = _msgSender();

        newLoyalty = ILoyaltyProgram(new LoyaltyProgram(_name, _symbol, _uri, _tierTracker, owner, amounts));

        getLoyaltyIDPerOwner[owner].push(_loyaltyID);
        getLoyaltyIDPerName[_name] = _loyaltyID;
        getLoyaltyAddress[_loyaltyID] = newLoyalty;
        loyaltyList.push(newLoyalty);

        Brand memory newBrand = Brand({productType: _productType, location: _location, owner: owner});
        brands[_loyaltyID] = newBrand;

        emit NewLoyaltyCreated(owner, newLoyalty, _loyaltyID, _name);

        return newLoyalty;
    }
}
