// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.20;

// import "hardhat/console.sol";
import {Context} from "@openzeppelin/contracts/utils/Context.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {AdminRegistry} from "../subscriptions/AdminRegistry.sol";
import {ILoyaltyProgram} from "../interfaces/ILoyaltyProgram.sol";
import {LoyaltyProgram} from "./LoyaltyProgram.sol";
import {Errors} from "../utils/Errors.sol";
import {IStorage} from "../interfaces/IStorage.sol";

/**
 * @title LoyaltyProgramFactory
 * @author @Pedrojok01
 * @notice Part of the Loyalty Platform
 * @dev Contracts factory to deploy the LoyaltyProgram ERC721;
 *  - Deployer can launch its own Membership program.
 *  - Deployer will receive NFT id 0, proving its ownership.
 *  - Stores all brand details into the Brand struct (allows filters)
 */

/**
 * Sighash   |   Function Signature
 * ================================
 * e35af2b8  =>  createNewLoyaltyProgram(string,string,string,bool,uint64[4],bytes16,bytes16)
 * 8a61cb3f  =>  getLoyaltyProgramPerIndex(uint256)
 * 8372de9e  =>  getTotalLoyaltyPrograms()
 * 5bf700a7  =>  _createNewLoyaltyProgram(uint256,string,string,string,bool,uint64[4],bytes16,bytes16)
 */

contract LoyaltyProgramFactory is Context, Errors, Ownable {
  /*///////////////////////////////////////////////////////////////////////////////
                                        STORAGE
    ///////////////////////////////////////////////////////////////////////////////*/

  address private immutable _STORAGE;
  // address private immutable CONTROL_ADDRESS; // Subscriptions contract address
  // address private _adminRegistry;

  /// @notice Array containing all factory addresses;
  address[] public factories;

  /// @notice Array containing all created LoyaltyProgram addresses;
  ILoyaltyProgram[] private loyaltyProgramList;

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

  /// @notice Map all LoyaltyProgram IDs per owner;
  mapping(address => uint256[]) private loyaltyIDPerOwner;

  /// @notice Map all LoyaltyProgram IDs per name;
  mapping(string => uint256) private loyaltyIDPerName;

  /// @notice Map a LoyaltyProgram ID per address;
  mapping(ILoyaltyProgram => uint256) private loyaltyIdPerAddress;

  /// @notice Map all LoyaltyProgram addresses per ID;
  mapping(uint256 => ILoyaltyProgram) private loyaltyAddress;

  /// @notice Map all brands details per ID;
  mapping(uint256 => Brand) private brands;

  /// @notice Map all factory address per ID and vice versa;
  mapping(uint256 => address) private factoryIdPerAddress;
  mapping(address => uint256) private fatoryAddressPerId;

  /// @notice Blacklist mapping, to either blacklist or "delete" a LoyaltyProgram
  mapping(address => bool) public blacklist;

  // solhint-disable-next-line no-unused-vars
  constructor(address storage_, address[] memory _factories, address _owner) Ownable(_owner) {
    _STORAGE = storage_;
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
   * @dev Call this function to create a new LoyaltyProgram contract.
   * @param name  Name of the new LoyaltyProgram (user input).
   * @param symbol  Symbol of the new LoyaltyProgram (user input).
   * @param uri  URI of the new LoyaltyProgram (user input).
   * @param tierTracker  Determine how the tier structure is calculated:
   *  - true = based on buyVolume;
   *  - false = based on amountVolume;
   * @param amounts  Amounts of either buyVolume or amountVolume needed to climb each tier.
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
    bytes32 productType,
    bytes32 location
  ) external returns (ILoyaltyProgram) {
    uint256 loyaltyId = loyaltyProgramList.length;

    if (loyaltyAddress[loyaltyId] != ILoyaltyProgram(address(0))) {
      revert LoyaltyProgramFactory__AlreadyExists();
    }

    if (loyaltyIDPerName[name] != 0) {
      revert LoyaltyProgramFactory__NameAlreadyTaken();
    }

    return
      _createNewLoyaltyProgram(
        loyaltyId,
        name,
        symbol,
        uri,
        tierTracker,
        amounts,
        bytes16(productType),
        bytes16(location)
      );
  }

  event NewLoyaltyProgramCreated(
    address owner,
    ILoyaltyProgram indexed newLoyaltyProgramAddress,
    uint256 indexed newLoyaltyProgramID,
    string newLoyaltyProgramName
  );

  /*///////////////////////////////////////////////////////////////////////////////
                                    VIEW FUNCTIONS
    ///////////////////////////////////////////////////////////////////////////////*/

  function getLoyaltyIDPerAddress(ILoyaltyProgram loyaltyProgram) external view returns (uint256) {
    return loyaltyIdPerAddress[loyaltyProgram];
  }

  function getLoyaltyIDPerOwner(address from) external view returns (uint256[] memory) {
    return loyaltyIDPerOwner[from];
  }

  function getLoyaltyIDPerName(string calldata name) external view returns (uint256) {
    return loyaltyIDPerName[name];
  }

  function getLoyaltyAddressPerId(uint256 loyaltyId) external view returns (ILoyaltyProgram) {
    return loyaltyAddress[loyaltyId];
  }

  /**
   * @dev Returs a LoyaltyProgram instance from an Id;
   * @param loyaltyId Id of the instance to look for;
   * @return loyaltyId Instance of the contract matching the loyaltyId;
   */
  function getLoyaltyProgramPerIndex(uint256 loyaltyId) external view returns (ILoyaltyProgram) {
    return loyaltyProgramList[loyaltyId];
  }

  /**
   * @dev Returs the amount of LoyaltyProgram created so far;
   */
  function getTotalLoyaltyPrograms() external view returns (uint256) {
    return loyaltyProgramList.length;
  }

  function getBrandDetails(uint256 loyaltyId) external view returns (Brand memory) {
    return brands[loyaltyId];
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

  // Checks whether a contract is blacklisted
  function isBlacklisted(address contractAddress) external view returns (bool) {
    return blacklist[contractAddress];
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
    if (index >= factories.length) revert LoyaltyProgramFactory__InvalidIndex();
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
    if (index >= factories.length) revert LoyaltyProgramFactory__InvalidIndex();
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

  /**
   * @dev Adds a contract to the blacklist
   */
  function blacklistContract(address contractAddress) external onlyOwner {
    if (blacklist[contractAddress]) revert LoyaltyProgramFactory__AlreadyBlacklisted();
    blacklist[contractAddress] = true;

    emit AddedToBlacklist(contractAddress);
  }

  event AddedToBlacklist(address contractAddress);

  /**
   * @dev Removes a contract from the blacklist
   */
  function unblacklistContract(address contractAddress) external onlyOwner {
    if (!blacklist[contractAddress]) revert LoyaltyProgramFactory__NotBlacklisted();
    blacklist[contractAddress] = false;

    emit RemovedFromblacklist(contractAddress);
  }

  event RemovedFromblacklist(address contractAddress);

  /*///////////////////////////////////////////////////////////////////////////////
                                    PRIVATE FUNCTIONS
    ///////////////////////////////////////////////////////////////////////////////*/

  function _createNewLoyaltyProgram(
    uint256 _loyaltyId,
    string memory _name,
    string memory _symbol,
    string memory _uri,
    bool _tierTracker,
    uint64[4] memory amounts,
    bytes16 _productType,
    bytes16 _location
  ) private returns (ILoyaltyProgram newLoyaltyProgram) {
    address _owner = _msgSender();

    AdminRegistry(IStorage(_STORAGE).getAdminRegistry()).registerOwner(_owner);
    newLoyaltyProgram = ILoyaltyProgram(
      new LoyaltyProgram(_name, _symbol, _uri, _tierTracker, _owner, amounts, _STORAGE, factories)
    );

    loyaltyIDPerOwner[_owner].push(_loyaltyId);
    loyaltyIDPerName[_name] = _loyaltyId;
    loyaltyAddress[_loyaltyId] = newLoyaltyProgram;
    loyaltyIdPerAddress[newLoyaltyProgram] = _loyaltyId;
    loyaltyProgramList.push(newLoyaltyProgram);

    Brand memory newBrand = Brand({productType: _productType, location: _location, owner: _owner});
    brands[_loyaltyId] = newBrand;

    emit NewLoyaltyProgramCreated(_owner, newLoyaltyProgram, _loyaltyId, _name);

    return newLoyaltyProgram;
  }
}
