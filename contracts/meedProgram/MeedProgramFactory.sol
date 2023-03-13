// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.18;

import {Context} from "@openzeppelin/contracts/utils/Context.sol";

import {IMeedProgram} from "../interfaces/IMeedProgram.sol";
import {MeedProgram} from "./MeedProgram.sol";
import {Errors} from "../utils/Errors.sol";

/**
 * @title MeedProgramFactory
 * @author Pedrojok01
 * @notice Part of the Meed Rewards platform from SuperUltra
 * @dev Contracts factory to deploy the MeedProgram ERC721;
 *  - Deployer can launch its own Membership program.
 *  - Deployer will receive NFT id 0, proving its ownership.
 *  - Stores all brand details into the Brand struct (allows filters)
 */

/**
 * Sighash   |   Function Signature
 * ================================
 * e35af2b8  =>  createNewMeedProgram(string,string,string,bool,uint64[4],bytes16,bytes16)
 * 8a61cb3f  =>  getMeedProgramPerIndex(uint256)
 * 8372de9e  =>  getNumberOfMeedProgram()
 * 5bf700a7  =>  _createNewMeedProgram(uint256,string,string,string,bool,uint64[4],bytes16,bytes16)
 */

contract MeedProgramFactory is Context, Errors {
    /*///////////////////////////////////////////////////////////////////////////////
                                        STORAGE
    ///////////////////////////////////////////////////////////////////////////////*/

    address[3] private factories;

    /**
     * @dev Main brand details to allow:
     * - For filters in UI/UX;
     * - To quickly get all MeedProgram per address;
     */
    struct Brand {
        bytes16 productType;
        bytes16 location;
        address owner;
    }

    /**
     * @notice Map all loyalty IDs per owner;
     */
    mapping(address => uint256[]) public getMeedIDPerOwner;

    /**
     * @notice Map all loyalty IDs per name;
     */
    mapping(string => uint256) public getLoyaltyIDPerName;

    /**
     * @notice Map all loyalty addresses per ID;
     */
    mapping(uint256 => IMeedProgram) public getLoyaltyAddress;

    /**
     * @notice Map all brands details per ID;
     */
    mapping(uint256 => Brand) public brands;

    /**
     * @notice Array containing all created MeedProgram addresses;
     */
    IMeedProgram[] public loyaltyList;

    constructor(address[3] memory _factories) {
        factories = _factories;
    }

    /*///////////////////////////////////////////////////////////////////////////////
                                        FACTORY
    ///////////////////////////////////////////////////////////////////////////////*/

    /**
     * @dev Call this function to create a new MeedProgram contract.
     * @param name  Name of the new MeedProgram (user input).
     * @param symbol  Symbol of the new MeedProgram (user input).
     * @param uri  URI of the new MeedProgram (user input).
     * @param productType  Type of products sold (user input).
     * @param location  Store location, in case of regional stores (user input).
     * @return newLoyalty Instance of the newly created contract.
     */
    function createNewMeedProgram(
        string memory name,
        string memory symbol,
        string memory uri,
        bool tierTracker,
        uint64[4] memory amounts,
        bytes16 productType,
        bytes16 location
    ) external returns (IMeedProgram newLoyalty) {
        uint256 loyaltyID = loyaltyList.length;

        if (getLoyaltyAddress[loyaltyID] != IMeedProgram(address(0))) {
            revert MeedProgramFactory_AlreadyExists();
        }

        return _createNewMeedProgram(loyaltyID, name, symbol, uri, tierTracker, amounts, productType, location);
    }

    event NewMeedProgramCreated(
        address owner,
        IMeedProgram indexed newLoyaltyAddress,
        uint256 indexed newLoyaltyID,
        string newLoyaltyName
    );

    /*///////////////////////////////////////////////////////////////////////////////
                                    VIEW FUNCTIONS
    ///////////////////////////////////////////////////////////////////////////////*/

    /**
     * @dev Returs a MeedProgram instance from an Id;
     * @param loyaltyId Id of the instance to look for;
     * @return loyaltyId Instance of the contract matching the loyaltyId;
     */
    function getMeedProgramPerIndex(uint256 loyaltyId) external view returns (IMeedProgram) {
        return loyaltyList[loyaltyId];
    }

    /**
     * @dev Returs the amount of MeedProgram created so far;
     */
    function getNumberOfMeedProgram() external view returns (uint256) {
        return loyaltyList.length - 1;
    }

    /*///////////////////////////////////////////////////////////////////////////////
                                    PRIVATE FUNCTIONS
    ///////////////////////////////////////////////////////////////////////////////*/

    function _createNewMeedProgram(
        uint256 _loyaltyID,
        string memory _name,
        string memory _symbol,
        string memory _uri,
        bool _tierTracker,
        uint64[4] memory amounts,
        bytes16 _productType,
        bytes16 _location
    ) private returns (IMeedProgram newLoyalty) {
        address owner = _msgSender();

        newLoyalty = IMeedProgram(new MeedProgram(_name, _symbol, _uri, _tierTracker, owner, amounts, factories));

        getMeedIDPerOwner[owner].push(_loyaltyID);
        getLoyaltyIDPerName[_name] = _loyaltyID;
        getLoyaltyAddress[_loyaltyID] = newLoyalty;
        loyaltyList.push(newLoyalty);

        Brand memory newBrand = Brand({productType: _productType, location: _location, owner: owner});
        brands[_loyaltyID] = newBrand;

        emit NewMeedProgramCreated(owner, newLoyalty, _loyaltyID, _name);

        return newLoyalty;
    }
}
