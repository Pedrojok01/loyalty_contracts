// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.18;

// import "hardhat/console.sol";
import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {ERC1155Burnable} from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";

import {IRedeemable} from "../interfaces/IRedeemable.sol";
import {TimeLimited} from "../utils/TimeLimited.sol";
import {SubscriberChecks} from "../subscriptions/SubscriberChecks.sol";
import {MeedProgram} from "../meedProgram/MeedProgram.sol";

/**
 * @title Redeemable
 * @author Pierre Estrabaud (@Pedrojok01)
 * @notice Part of the Meed Rewards platform from SuperUltra
 * @dev Reedemable are NFTs that can be redeemed for a product or a discount;
 *  - The redeemanle type is defined by its id (0-5)
 *  - productIdOrCurrency indicate either the ID of the redeemable product or the currency in case of reduction voucher;
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
 * f32c02ab  =>  redeem(address,uint256,uint32)
 * f48cc326  =>  isRedeemable(uint256)
 * e82e55cd  =>  getRedeemable(uint256)
 * 8e264182  =>  getTotalRedeemablesSupply()
 * 3bc06d6c  =>  addNewRedeemableNFT(RedeemableType,uint120,bytes32)
 * 02fe5305  =>  setURI(string)
 * 0b075f1a  =>  _isValidType(RedeemableType)
 * d410d6e2  =>  _isValidId(uint256)
 * ffdc4334  =>  _addNewRedeemableNFT(RedeemableType,uint120)
 * 810bdd65  =>  _onlyOngoing()
 */

contract Redeemable is ERC1155, IRedeemable, ERC1155Burnable, TimeLimited, SubscriberChecks {
    /*///////////////////////////////////////////////////////////////////////////////
                                        STORAGE
    ///////////////////////////////////////////////////////////////////////////////*/

    MeedProgram private immutable meedProgram;

    enum RedeemableType {
        ProductId, // 0
        Amount, // 1
        Percentage // 2
    }

    struct RedeemableNFT {
        RedeemableType redeemableType;
        uint8 id;
        uint120 value;
        uint120 circulatingSupply;
        bool exist;
        // bytes32 productIdOrCurrency;
    }

    RedeemableNFT[] private redeemableNFTs; // Up to 5 differents redeemable NFTs (contract)

    constructor(
        string memory _uri,
        address _owner,
        uint256 _expirationDate,
        address _meedProgram,
        address _contractAddress
    ) ERC1155(_uri) TimeLimited(_expirationDate, address(this)) SubscriberChecks(_contractAddress) {
        require(_expirationDate > block.timestamp, "Redeemable: invalid date");
        _setURI(_uri);
        meedProgram = MeedProgram(_meedProgram);
        transferOwnership(_owner);
        transferAdminship(_owner);
    }

    modifier onlyOngoing() override {
        _onlyOngoing();
        _;
    }

    /*///////////////////////////////////////////////////////////////////////////////
                                MINT / BATCH-MINT / REDEEM
    ///////////////////////////////////////////////////////////////////////////////*/

    /**
    @dev Limited mint, only the owner can mint the level 2 and above NFTs;
    @param id Allow to choose the kind of NFT to be minted;
    @param to Address which will receive the limited NFTs;
    @param lvlMin Level required to mint the NFT (set to 1 for no level requirement);
    */
    function mint(
        uint256 id,
        address to,
        uint256 lvlMin
    ) public onlyOwnerOrAdmin onlyOngoing onlyActive onlySubscribers {
        if (!_isValidId(id)) revert Redeemable__WrongId();
        uint8 currentLevel = meedProgram.getMemberLevel(to);
        if (currentLevel == 0) revert Redeemable__NonExistantUser();
        if (currentLevel < uint8(lvlMin)) revert Redeemable__InsufficientLevel();

        redeemableNFTs[id].circulatingSupply++;
        _mint(to, id, 1, "");
    }

    /**
     * @dev Mint a new NFT to a batch of specified addresses;
     * @param id Allow to choose the kind of NFT to be minted;
     * @param to Array of addresses to mint to; must be members of the loyalty program;
     * @param lvlMin Level required to mint the NFT (set to 0 for no level requirement);
     */
    function batchMint(
        uint256 id,
        address[] calldata to,
        uint8 lvlMin
    ) external onlyOwnerOrAdmin onlyOngoing onlyActive onlyProOrEnterprise {
        uint256 length = to.length;
        for (uint256 i = 0; i < length; i++) {
            mint(id, to[i], lvlMin);
        }
    }

    function redeem(
        address from,
        uint256 tokenId,
        uint32 amount
    ) external override onlyOngoing onlyActive onlyOwnerOrAdmin {
        if (!isRedeemable(tokenId)) revert Redeemable__TokenNotRedeemable(tokenId);
        if (!(balanceOf(from, tokenId) >= 1)) revert Redeemable__TokenNotOwned();

        redeemableNFTs[tokenId].circulatingSupply--;
        burn(from, tokenId, 1);
        meedProgram.updateMember(from, 1, amount);

        emit Redeemed(from, tokenId);
    }

    /*///////////////////////////////////////////////////////////////////////////////
                                        VIEW
    ///////////////////////////////////////////////////////////////////////////////*/

    function isRedeemable(uint256 _id) public view override returns (bool) {
        if (!_isValidId(_id)) revert Redeemable__WrongId();
        return (_isSupplyForId(_id) && this.isActive() && !this.isExpired());
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
     * @param data Data of the redeemable NFT (productId for ProductId, currency for Amount);
     */
    function addNewRedeemableNFT(
        RedeemableType redeemType,
        uint120 value,
        bytes32 data
    ) external onlyOwnerOrAdmin onlyOngoing onlyActive {
        _addNewRedeemableNFT(redeemType, value);
        emit NewTypeAdded(redeemType, value, data);
    }

    event NewTypeAdded(RedeemableType indexed redeemType, uint120 value, bytes32 productIdOrCurrency);

    function setURI(string memory newuri) external onlyOwnerOrAdmin onlyOngoing onlyActive {
        _setURI(newuri);
        emit NewURISet(newuri);
    }

    event NewURISet(string newuri);

    /*///////////////////////////////////////////////////////////////////////////////
                                        PRIVATE
    ///////////////////////////////////////////////////////////////////////////////*/

    function _isValidId(uint256 _id) private view returns (bool) {
        if (_id < redeemableNFTs.length) {
            return redeemableNFTs[_id].exist;
        } else return false;
    }

    function _isValidType(RedeemableType _redeemType) private pure returns (bool) {
        if (
            _redeemType == RedeemableType.ProductId ||
            _redeemType == RedeemableType.Amount ||
            _redeemType == RedeemableType.Percentage
        ) {
            return true;
        }
        return false;
    }

    function _isSupplyForId(uint256 _id) private view returns (bool) {
        return redeemableNFTs[_id].circulatingSupply > 0;
    }

    function _addNewRedeemableNFT(RedeemableType redeemType, uint120 _value) private {
        if (!_isValidType(redeemType)) revert Redeemable__WrongType();
        if (_value == 0) revert Redeemable__WrongValue();

        redeemableNFTs.push();
        uint256 _id = redeemableNFTs.length - 1;
        redeemableNFTs[_id].redeemableType = redeemType;
        redeemableNFTs[_id].id = uint8(_id);
        redeemableNFTs[_id].value = _value;
        redeemableNFTs[_id].exist = true;
        redeemableNFTs[_id].circulatingSupply = 0;
    }

    function burn(address account, uint256 id, uint256 value) public override {
        require(
            account == _msgSender() ||
                isApprovedForAll(account, _msgSender()) ||
                _msgSender() == owner() ||
                _msgSender() == admin(),
            "ERC1155: not owner or approved"
        );

        _burn(account, id, value);
    }

    function _onlyOngoing() internal override {
        if (this.isExpired()) {
            if (this.isActive()) {
                this.deactivate();
                meedProgram.switchStatus(address(this), false);
            }
            revert Expirable__EventExpired();
        }
    }
}
