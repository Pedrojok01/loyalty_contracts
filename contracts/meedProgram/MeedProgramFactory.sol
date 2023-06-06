// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.19;

// import "hardhat/console.sol";
import {Context} from "@openzeppelin/contracts/utils/Context.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {AdminRegistry} from "../subscriptions/AdminRegistry.sol";
import {IMeedProgram} from "../interfaces/IMeedProgram.sol";
import {MeedProgram} from "./MeedProgram.sol";
import {Errors} from "../utils/Errors.sol";

/**
 * @title MeedProgramFactory
 * @author Pedrojok01
 * @notice Part of the Meed Loyalty Platform from SuperUltra
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
 * 8372de9e  =>  getTotalMeedPrograms()
 * 5bf700a7  =>  _createNewMeedProgram(uint256,string,string,string,bool,uint64[4],bytes16,bytes16)
 */

contract MeedProgramFactory is Context, Errors, Ownable {
  /*///////////////////////////////////////////////////////////////////////////////
                                        STORAGE
    ///////////////////////////////////////////////////////////////////////////////*/

  address private immutable CONTROL_ADDRESS; // Subscriptions contract address
  address private _adminRegistry;
  address[] public factories;

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
   * @notice Map all MeedProgram IDs per owner;
   */
  mapping(address => uint256[]) private meedIDPerOwner;

  /**
   * @notice Map all MeedProgram IDs per name;
   */
  mapping(string => uint256) private meedIDPerName;

  /**
   * @notice Map a MeedProgram ID per address;
   */
  mapping(IMeedProgram => uint256) private meedIdPerAddress;

  /**
   * @notice Map all MeedProgram addresses per ID;
   */
  mapping(uint256 => IMeedProgram) private meedAddress;

  /**
   * @notice Map all brands details per ID;
   */
  mapping(uint256 => Brand) private brands;

  /**
   * @notice Array containing all created MeedProgram addresses;
   */
  IMeedProgram[] private meedProgramList;

  /**
   * @notice Map all factory address per ID and vice versa;
   */
  mapping(uint256 => address) private factoryIdPerAddress;
  mapping(address => uint256) private fatoryAddressPerId;

  constructor(address _controlAddress, address adminRegistryAddress, address[] memory _factories) {
    CONTROL_ADDRESS = _controlAddress;
    _adminRegistry = adminRegistryAddress;
    factories = _factories;

    uint256 length = _factories.length;
    for (uint256 i = 0; i < length; ) {
      factoryIdPerAddress[i] = _factories[i];
      fatoryAddressPerId[_factories[i]] = i;
      unchecked {
        i++;
      }
    }
  }

  /*///////////////////////////////////////////////////////////////////////////////
                                        FACTORY
    ///////////////////////////////////////////////////////////////////////////////*/

  /**
   * @dev Call this function to create a new MeedProgram contract.
   * @param name  Name of the new MeedProgram (user input).
   * @param symbol  Symbol of the new MeedProgram (user input).
   * @param uri  URI of the new MeedProgram (user input).
   * @param tierTracker  Determine how the tier structure is calculated:
   *  - true = based on buyVolume;
   *  - false = based on amountVolume;
   * @param amounts  Amounts of either buyVolume or amountVolume needed to climb each tier.
   * @param productType  Type of products sold (user input).
   * @param location  Store location, in case of regional stores (user input).
   * @return newMeed Instance of the newly created contract.
   */
  function createNewMeedProgram(
    string memory name,
    string memory symbol,
    string memory uri,
    bool tierTracker,
    uint64[4] memory amounts,
    bytes32 productType,
    bytes32 location
  ) external returns (IMeedProgram newMeed) {
    uint256 meedId = meedProgramList.length;

    if (meedAddress[meedId] != IMeedProgram(address(0))) {
      revert MeedProgramFactory_AlreadyExists();
    }

    if (meedIDPerName[name] != 0) {
      revert MeedProgramFactory_NameAlreadyTaken();
    }

    return
      _createNewMeedProgram(
        meedId,
        name,
        symbol,
        uri,
        tierTracker,
        amounts,
        bytes16(productType),
        bytes16(location)
      );
  }

  event NewMeedProgramCreated(
    address owner,
    IMeedProgram indexed newMeedProgramAddress,
    uint256 indexed newMeedProgramID,
    string newMeedProgramName
  );

  /*///////////////////////////////////////////////////////////////////////////////
                                    VIEW FUNCTIONS
    ///////////////////////////////////////////////////////////////////////////////*/

  function getMeedIDPerAddress(IMeedProgram meedProgram) external view returns (uint256) {
    return meedIdPerAddress[meedProgram];
  }

  function getMeedIDPerOwner(address from) external view returns (uint256[] memory) {
    return meedIDPerOwner[from];
  }

  function getMeedIDPerName(string calldata name) external view returns (uint256) {
    return meedIDPerName[name];
  }

  function getMeedAddressPerId(uint256 meedId) external view returns (IMeedProgram) {
    return meedAddress[meedId];
  }

  /**
   * @dev Returs a MeedProgram instance from an Id;
   * @param meedId Id of the instance to look for;
   * @return meedId Instance of the contract matching the meedId;
   */
  function getMeedProgramPerIndex(uint256 meedId) external view returns (IMeedProgram) {
    return meedProgramList[meedId];
  }

  /**
   * @dev Returs the amount of MeedProgram created so far;
   */
  function getTotalMeedPrograms() external view returns (uint256) {
    return meedProgramList.length;
  }

  function getBrandDetails(uint256 meedId) external view returns (Brand memory) {
    return brands[meedId];
  }

  /**
   * @dev Returns the factory address for a given ID;
   */
  function getFactoryAddress(uint256 id) external view returns (address) {
    return factoryIdPerAddress[id];
  }

  /**
   * @dev Returns the factory ID for a given address;
   */
  function getFactoryId(address factory) external view returns (uint256) {
    return fatoryAddressPerId[factory];
  }

  /*///////////////////////////////////////////////////////////////////////////////
                                   RESTRICTED FACTORY FUNCTIONS
    ///////////////////////////////////////////////////////////////////////////////*/

  /**
   * @dev Setter function that allows the owner to add a new Factory;
   */
  function addFactory(address factory) external onlyOwner {
    uint256 id = factories.length;
    factories.push(factory);

    factoryIdPerAddress[id] = factory;
    fatoryAddressPerId[factory] = id;

    emit NewFactoryAdded(factory);
  }

  event NewFactoryAdded(address factory);

  /**
   * @dev Updater function that allows the owner to modify a factory at a specific index;
   */
  function updateFactory(uint256 index, address factory) external onlyOwner {
    if (index >= factories.length) revert MeedProgramFactory_InvalidIndex();
    address oldFactory = factories[index];
    factories[index] = factory;

    factoryIdPerAddress[index] = factory;
    fatoryAddressPerId[factory] = index;

    emit FactoryUpdatedAdded(oldFactory, factory);
  }

  event FactoryUpdatedAdded(address oldFactory, address newFactory);

  /**
   * @dev Deleter function that allows the owner to remove a factory at a specific index;
   */
  function removeFactory(uint256 index) external onlyOwner {
    if (index >= factories.length) revert MeedProgramFactory_InvalidIndex();
    address oldFactory = factories[index];
    address lastFactory = factories[factories.length - 1];

    // Move the last element to the position of the element to be removed
    factories[index] = factories[factories.length - 1];
    // Remove the last element
    factories.pop();

    // Update the mappings
    factoryIdPerAddress[index] = lastFactory;
    fatoryAddressPerId[lastFactory] = index;

    // Delete the lastFactory from the mappings
    delete factoryIdPerAddress[factories.length];
    delete fatoryAddressPerId[oldFactory];

    emit FactoryDeleted(oldFactory, index);
  }

  event FactoryDeleted(address factory, uint256 index);

  /*///////////////////////////////////////////////////////////////////////////////
                                    PRIVATE FUNCTIONS
    ///////////////////////////////////////////////////////////////////////////////*/

  function _createNewMeedProgram(
    uint256 _meedId,
    string memory _name,
    string memory _symbol,
    string memory _uri,
    bool _tierTracker,
    uint64[4] memory amounts,
    bytes16 _productType,
    bytes16 _location
  ) private returns (IMeedProgram newMeedProgram) {
    address _owner = _msgSender();

    AdminRegistry(_adminRegistry).registerOwner(_owner);
    newMeedProgram = IMeedProgram(
      new MeedProgram(
        _name,
        _symbol,
        _uri,
        _tierTracker,
        _owner,
        amounts,
        _adminRegistry,
        CONTROL_ADDRESS,
        factories
      )
    );

    meedIDPerOwner[_owner].push(_meedId);
    meedIDPerName[_name] = _meedId;
    meedAddress[_meedId] = newMeedProgram;
    meedIdPerAddress[newMeedProgram] = _meedId;
    meedProgramList.push(newMeedProgram);

    Brand memory newBrand = Brand({productType: _productType, location: _location, owner: _owner});
    brands[_meedId] = newBrand;

    emit NewMeedProgramCreated(_owner, newMeedProgram, _meedId, _name);

    return newMeedProgram;
  }
}
