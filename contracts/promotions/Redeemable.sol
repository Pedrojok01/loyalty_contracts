// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.19;

// import "hardhat/console.sol";
import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

import {IRedeemable} from "../interfaces/IRedeemable.sol";
import {ICampaign} from "../interfaces/ICampaign.sol";
import {TimeLimited} from "../utils/TimeLimited.sol";
import {SubscriberChecks} from "../subscriptions/SubscriberChecks.sol";
import {MeedProgram} from "../meedProgram/MeedProgram.sol";
import {RedeemCodeLib} from "../library/RedeemCodeLib.sol";

/**
 * @title Redeemable
 * @author Pierre Estrabaud (@Pedrojok01)
 * @notice Part of the Meed Loyalty Platform
 * @dev Reedemable are NFTs that can be redeemed for a product or a discount;
 *  - The redeemanle type is defined by its id
 *  - productId (for freebies) or currency (for fiat discount) are now added to metadata ans store in IPFS;
 *  - Discount can either be a percentage (0-100) or an amount;
 *  - The vouchers are burned when used;
 *
 *  - USAGE:
 *  - 1. Create a new contract with the desired redeemable NFTs;
 *  - 2. Emit the NFTs to the users;
 *  - 3. When a user wants to redeem a NFT, call the isRedeemable function to check if the NFT is redeemable;
 *  - 4. If the NFT is redeemable, call the getRedeemable function to get the redeemable data;
 *  - 5. OFF-CHAIN: Apply the discount, then wait for the payment confirmation;
 *  - 6. Call the redeem function to burn the NFT;
 */

/**
 *  Sighash   |   Function Signature
 * =================================
 * 836a1040  =>  mint(uint256,address,uint256)
 * 104d4a1a  =>  batchMint(uint256,address[],uint8)
 * f32c02ab  =>  redeem(address,uint256)
 * f48cc326  =>  isRedeemable(uint256)
 * e82e55cd  =>  getRedeemable(uint256)
 * 8e264182  =>  getTotalRedeemablesSupply()
 * 3bc06d6c  =>  addNewRedeemableNFT(RedeemableType,uint120,bytes32)
 * 02fe5305  =>  setURI(string)
 * d410d6e2  =>  _isValidId(uint256)
 * ffdc4334  =>  _addNewRedeemableNFT(RedeemableType,uint120)
 * 810bdd65  =>  _onlyOngoing()
 */

contract Redeemable is ERC1155, IRedeemable, ICampaign, TimeLimited {
  using RedeemCodeLib for RedeemCodeLib.RedeemCodeStorage;

  /*///////////////////////////////////////////////////////////////////////////////
                                        STORAGE
    ///////////////////////////////////////////////////////////////////////////////*/

  MeedProgram private immutable meedProgram;
  RedeemCodeLib.RedeemCodeStorage internal redeemCodeStorage;

  enum RedeemableType {
    ProductId, // 0
    Amount, // 1
    Percentage // 2
  }

  struct RedeemableNFT {
    uint120 circulatingSupply; // 15 bytes - Slot I
    uint112 value; // 14 bytes
    RedeemableType redeemableType; // 1 byte
    bool exist; // 1 byte
    uint8 id; // 1 byte
    uint32 amountRequirement; // 4 bytes - Slot II
    string redeemCode; // 32 bytes
  }

  RedeemableNFT[] private redeemableNFTs;

  constructor(
    string memory _uri,
    address _owner,
    uint256 _startDate,
    uint256 _endDate,
    address _meedProgram,
    address subscriptionsAddress,
    address adminRegistryAddress
  ) ERC1155(_uri) TimeLimited(_startDate, _endDate, subscriptionsAddress, adminRegistryAddress) {
    require(_endDate == 0 || _endDate > block.timestamp, "Redeemable: invalid date");
    _setURI(_uri);
    meedProgram = MeedProgram(_meedProgram);
    transferOwnership(_owner);
  }

  /*///////////////////////////////////////////////////////////////////////////////
                                MINT / BATCH-MINT / REDEEM
    ///////////////////////////////////////////////////////////////////////////////*/

  /**
    @dev Limited mint - only the owner can mint the level 2 and above NFTs;
    @param id Allow to choose the kind of NFT to be minted;
    @param to Address which will receive the limited NFTs;
    */
  function mint(uint256 id, address to) public onlyOwnerOrAdmin onlyOngoing onlyActive {
    if (_msgSender() == admin()) {
      _onlySubscribers(owner());
    }

    _mintRedeemable(id, to);
  }

  /**
    @dev Limited mint - only the owner can mint the level 2 and above NFTs;
    @param id Allow to choose the kind of NFT to be minted;
    @param to Address which will receive the limited NFTs;
    */
  function autoMint(uint256 id, address to) external onlyOngoing onlyActive {
    if (_msgSender() != address(meedProgram)) revert Redeemable__NotCalledFromContract();
    _onlySubscribers(owner());
    _mintRedeemable(id, to);
  }

  /**
   * @dev Mint a new NFT to a batch of specified addresses;
   * @param id Allow to choose the kind of NFT to be minted;
   * @param to Array of addresses to mint to; must be members of the loyalty program;
   */
  function batchMint(
    uint256 id,
    address[] calldata to
  ) external onlyOwnerOrAdmin onlyOngoing onlyActive {
    if (_msgSender() == admin()) {
      _onlyProOrEnterprise(owner());
    }

    uint256 length = to.length;
    for (uint256 i = 0; i < length; ) {
      mint(id, to[i]);
      unchecked {
        i++;
      }
    }
  }

  /**
   * @dev Allows to redeem a Voucher;
   * @param from Address to burn the NFT from;
   * @param tokenId  Id of the NFT to burn;
   */
  function redeem(
    address from,
    uint256 tokenId
  ) public override onlyOngoing onlyActive onlyOwnerOrAdmin {
    _redeem(from, tokenId);
  }

  /**
   * @dev Allows to redeem a Voucher from a redeem code;
   * @param from Address to burn the NFT from;
   * @param code  Redeem code of the NFT to burn;
   */
  function redeemFromCode(address from, string memory code) external {
    (address contractAddress, uint256 tokenId) = redeemCodeStorage.getDataFromRedeemCode(code);
    if (contractAddress != address(this)) revert Redeemable__WrongPromotionContract();

    redeem(from, tokenId);
  }

  function burn(address account, uint256 id, uint256 value) public {
    require(
      account == _msgSender() ||
        isApprovedForAll(account, _msgSender()) ||
        _msgSender() == owner() ||
        _msgSender() == admin(),
      "ERC1155: not owner or approved"
    );

    _burn(account, id, value);
  }

  /*///////////////////////////////////////////////////////////////////////////////
                                        VIEW
    ///////////////////////////////////////////////////////////////////////////////*/

  function isRedeemable(uint256 _id) public view override returns (bool) {
    if (!_isValidId(_id)) revert Redeemable__WrongId();
    return (_isSupplyForId(_id) && isActive() && !isExpired());
  }

  function getRedeemable(uint256 _id) external view returns (RedeemableNFT memory) {
    if (!_isValidId(_id)) revert Redeemable__WrongId();
    return redeemableNFTs[_id];
  }

  function getTotalRedeemablesSupply() external view returns (uint256) {
    return redeemableNFTs.length;
  }

  /*///////////////////////////////////////////////////////////////////////////////
                                        RESTRICTED
    ///////////////////////////////////////////////////////////////////////////////*/

  /**
   * @dev Add a new redeemable NFT type to the contract;
   * @param redeemType Type of the redeemable NFT (ProductId, Amount, Percentage);
   * @param value Value of the redeemable NFT (in fiat currency or % );
   * @param amountRequirement Purchased amount required to trigger a voucher autoMint;
   */
  function addNewRedeemableNFT(
    RedeemableType redeemType,
    uint256 value,
    uint256 amountRequirement
  ) external onlyOwnerOrAdmin onlyOngoing onlyActive {
    _addNewRedeemableNFT(redeemType, uint112(value), amountRequirement);
    emit NewTypeAdded(redeemType, uint112(value));
  }

  event NewTypeAdded(RedeemableType indexed redeemType, uint112 value);

  function setURI(string memory newuri) external onlyOwnerOrAdmin onlyOngoing onlyActive {
    _setURI(newuri);
    emit NewURISet(newuri);
  }

  event NewURISet(string newuri);

  /**
   * @dev Allows to activate a promotion
   */
  function activatePromotion() external onlyOwnerOrAdmin {
    _activate(address(this));
  }

  /**
   * @dev Allows to deactivate a promotion
   */
  function deactivatePromotion() external onlyOwnerOrAdmin {
    _deactivate(address(this));
  }

  /*///////////////////////////////////////////////////////////////////////////////
                                        PRIVATE
    ///////////////////////////////////////////////////////////////////////////////*/

  /// @dev Common function to mint a Redeemable NFT;
  function _mintRedeemable(uint256 id, address to) private {
    if (!_isValidId(id)) revert Redeemable__WrongId();
    uint8 currentLevel = meedProgram.getMemberLevel(to);
    if (currentLevel == 0) revert Redeemable__NonExistantUser();

    redeemableNFTs[id].circulatingSupply++;
    _mint(to, id, 1, "");
  }

  function _redeem(address from, uint256 tokenId) private {
    if (_msgSender() != owner()) {
      _onlySubscribers(owner());
    }
    if (!isRedeemable(tokenId)) revert Redeemable__TokenNotRedeemable(tokenId);
    if (!(balanceOf(from, tokenId) >= 1)) revert Redeemable__TokenNotOwned();

    redeemableNFTs[tokenId].circulatingSupply--;
    burn(from, tokenId, 1);

    emit Redeemed(from, tokenId);
  }

  function _isValidId(uint256 _id) private view returns (bool) {
    if (_id < redeemableNFTs.length) {
      return redeemableNFTs[_id].exist;
    } else return false;
  }

  function _isSupplyForId(uint256 _id) private view returns (bool) {
    return redeemableNFTs[_id].circulatingSupply > 0;
  }

  function _addNewRedeemableNFT(
    RedeemableType redeemType,
    uint112 _value,
    uint256 _amountRequirement
  ) private {
    if (_value == 0 && redeemType != RedeemableType.ProductId) revert Redeemable__WrongValue();

    uint256 _id = redeemableNFTs.length;

    RedeemableNFT memory newRedeemableNFT = RedeemableNFT({
      redeemableType: redeemType,
      id: uint8(_id),
      value: _value,
      exist: true,
      circulatingSupply: 0,
      amountRequirement: uint32(_amountRequirement),
      redeemCode: redeemCodeStorage.generateRedeemCode(address(this), _id)
    });

    redeemableNFTs.push(newRedeemableNFT);
  }
}
