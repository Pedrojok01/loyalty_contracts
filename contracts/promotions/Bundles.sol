// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.18;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {ERC721Holder} from "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {ERC1155Receiver} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Receiver.sol";

import {Adminable} from "../utils/Adminable.sol";
import {TimeLimited} from "../utils/TimeLimited.sol";
import {IBundles} from "../interfaces/IBundles.sol";
import {LoyaltyProgram} from "../loyaltyProgram/LoyaltyProgram.sol";

/**
 * @title EventTicket
 * @author Pedrojok01
 * @notice Part of the Meed Rewards platform from SuperUltra
 * @dev Bundles assets into an NFT:
 *  - Can either be airdrop to a specified membership level, or
 *  - Minted upon condition.
 *
 * Contract based on the EIP-3589: https://eips.ethereum.org/EIPS/eip-3589
 */

contract Bundles is ERC721, ERC721Holder, ERC1155Holder, IBundles, TimeLimited {
    using SafeERC20 for IERC20;

    string private _baseURIextended;
    LoyaltyProgram immutable loyaltyProgram;
    uint256 public immutable maxPackSupply;
    uint256 nonce;

    constructor(
        string memory _name,
        string memory _symbol,
        string memory _uri,
        uint256 _expirationDate,
        address _loyaltyProgram,
        uint256 _data,
        address _owner
    ) ERC721(_name, _symbol) TimeLimited(_expirationDate) {
        maxPackSupply = _data;
        _baseURIextended = _uri;
        loyaltyProgram = LoyaltyProgram(_loyaltyProgram);
        transferOwnership(_owner);
        transferAdminship(_owner);
    }

    modifier onlyOngoing() override {
        _onlyOngoing();
        _;
    }

    /*///////////////////////////////////////////////////////////////////////////////
                                MINT / BATCH_MINT / BURN
    ///////////////////////////////////////////////////////////////////////////////*/

    /**
     * @dev Generate a hash of all assets sent to the escrow contract. This hash is used as token_id and is the "key" to claim the assets back.
     * @param _salt Index-like parameter incremented by one with each new created NFT to prevent collision.
     * @param _addresses Array containing all the contract addresses of every assets sent to the escrow contract. See layout below.
     * @param _numbers Array containing numbers, amounts and IDs for every assets sent to the escrow contract. See layout below.
     *
     * @notice layout of _addresses:
     *   erc20 addresses | erc721 addresses | erc1155 addresses
     * @notice layout of _numbers:
     *   eth | erc20.length | erc721.length | erc1155.length | erc20 amounts | erc721 ids | erc1155 ids | erc1155 amounts
     */
    function hash(
        uint256 _salt,
        address[] calldata _addresses,
        uint256[] memory _numbers
    ) public pure override returns (uint256 tokenId) {
        bytes32 signature = keccak256(abi.encodePacked(_salt));
        for (uint256 i = 0; i < _addresses.length; i++) {
            signature = keccak256(abi.encodePacked(signature, _addresses[i]));
        }
        for (uint256 j = 0; j < _numbers.length; j++) {
            signature = keccak256(abi.encodePacked(signature, _numbers[j]));
        }
        assembly {
            tokenId := signature
        }
    }

    /**
     * @dev Transfer all assets to the escrow contract and emit an ERC721 NFT with a hash as token_id.
     * @param _addresses Array containing all the contract addresses of every assets sent to the escrow contract.
     * @param _numbers Array containing numbers, amounts and IDs for every assets sent to the escrow contract.
     */
    function safeMint(
        address _to,
        address[] calldata _addresses,
        uint256[] memory _numbers
    ) external payable override onlyOwnerOrAdmin onlyOngoing returns (uint256 tokenId) {
        if (_to == address(0)) revert Bundles__MintToAddress0();
        if (_addresses.length != _numbers[1] + _numbers[2] + _numbers[3]) revert Bundles__ArraysDontMatch();
        if (_addresses.length != _numbers.length - 4 - _numbers[3]) revert Bundles__NumbersDontMatch();
        if (maxPackSupply != 0 && nonce >= maxPackSupply) revert Bundles__MaxSupplyReached();

        uint256 pointerA; //points to first erc20 address, if any
        uint256 pointerB = 4; //points to first erc20 amount, if any
        for (uint256 i = 0; i < _numbers[1]; i++) {
            if (_numbers[pointerB] <= 0) revert Bundles__CantSendZeroAmount();

            IERC20 token = IERC20(_addresses[pointerA++]);
            uint256 orgBalance = token.balanceOf(address(this));
            token.safeTransferFrom(_msgSender(), address(this), _numbers[pointerB]);
            _numbers[pointerB++] = token.balanceOf(address(this)) - orgBalance;
        }
        for (uint256 j = 0; j < _numbers[2]; j++) {
            IERC721(_addresses[pointerA++]).safeTransferFrom(_msgSender(), address(this), _numbers[pointerB++]);
        }
        for (uint256 k = 0; k < _numbers[3]; k++) {
            IERC1155(_addresses[pointerA++]).safeTransferFrom(
                _msgSender(),
                address(this),
                _numbers[pointerB],
                _numbers[_numbers[3] + pointerB++],
                ""
            );
        }
        tokenId = hash(nonce, _addresses, _numbers);
        super._mint(_to, tokenId);
        emit BundleAsset(_to, tokenId, nonce, _addresses, _numbers);
        nonce++;
    }

    event BundleAsset(address _to, uint256 tokenId, uint256 nonce, address[] _addresses, uint256[] _numbers);

    /**
     * @dev Burn a previously emitted NFT to claim all the associated assets from the escrow contract.
     * @param _addresses Array containing all the contract addresses of every assets sent to the escrow contract. Emitted in the BundleAsset event (see interface).
     * @param _arrayOfNumbers Array of arrays containing numbers, amounts and IDs for every batch of assets sent to the escrow contract.
     * @param _amountOfPacks === the number of packs that will be minted in this batch.
     */
    function batchMint(
        address _to,
        address[] calldata _addresses,
        uint256[][] calldata _arrayOfNumbers,
        uint256 _amountOfPacks
    ) external payable onlyOwnerOrAdmin onlyOngoing {
        if (_to == address(0)) revert Bundles__MintToAddress0();
        if (msg.value != _arrayOfNumbers[0][0] * _amountOfPacks) revert Bundles__ValuesDontMatch();
        if (maxPackSupply != 0 && nonce + _amountOfPacks > maxPackSupply) revert Bundles__MaxSupplyReached();

        for (uint256 i = 0; i < _amountOfPacks; i++) {
            this.safeMint(_to, _addresses, _arrayOfNumbers[i]);
        }

        emit BatchBundleAsset(_to, _amountOfPacks);
    }

    event BatchBundleAsset(address indexed firstHolder, uint256 amountOfPacks);

    /**
     * @dev Burn a previously emitted NFT to claim all the associated assets from the escrow contract.
     * @param _tokenId === hash of all associated assets.
     * @param _salt === nonce. Emitted in the BundleAsset event (see interface).
     * @param _addresses Array containing all the contract addresses of every assets sent to the escrow contract. Emitted in the BundleAsset event (see interface).
     * @param _numbers Array containing numbers, amounts and IDs for every assets sent to the escrow contract. Emitted in the BundleAsset event (see interface).
     */
    function burn(
        address _to,
        uint256 _tokenId,
        uint256 _salt,
        address[] calldata _addresses,
        uint256[] calldata _numbers
    ) external override onlyOngoing {
        if (_msgSender() != ownerOf(_tokenId)) revert Bundles__TokenNotOwned();
        require(_tokenId == hash(_salt, _addresses, _numbers));

        super._burn(_tokenId);

        uint256 pointerA; //points to first erc20 address, if there is any
        uint256 pointerB = 4; //points to first erc20 amount, if there is any
        for (uint256 i = 0; i < _numbers[1]; i++) {
            IERC20(_addresses[pointerA++]).safeTransfer(_to, _numbers[pointerB++]);
        }
        for (uint256 j = 0; j < _numbers[2]; j++) {
            IERC721(_addresses[pointerA++]).safeTransferFrom(address(this), _to, _numbers[pointerB++]);
        }
        for (uint256 k = 0; k < _numbers[3]; k++) {
            IERC1155(_addresses[pointerA++]).safeTransferFrom(
                address(this),
                _to,
                _numbers[pointerB],
                _numbers[_numbers[3] + pointerB++],
                ""
            );
        }

        payable(_to).transfer(_numbers[0]);

        emit BundleAssetClaimed(_tokenId, _to, _addresses, _numbers);
    }

    event BundleAssetClaimed(uint256 tokenId, address _to, address[] _addresses, uint256[] _numbers);

    /*///////////////////////////////////////////////////////////////////////////////
                                        VIEW
    ///////////////////////////////////////////////////////////////////////////////*/

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        if (!_exists(tokenId)) {
            revert Bundles__TokenURIQueryForNonexistentToken();
        }
        return _baseURIextended;
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC1155Receiver) returns (bool) {
        return ERC721.supportsInterface(interfaceId) || ERC1155Receiver.supportsInterface(interfaceId);
    }

    /*///////////////////////////////////////////////////////////////////////////////
                                    INTERNAL / PRIVATE
    ///////////////////////////////////////////////////////////////////////////////*/

    function _onlyOngoing() internal override {
        if (this.isExpired()) {
            if (this.isActive()) {
                this.deactivate();
                loyaltyProgram.switchStatus(address(this), false);
            }
            revert Expirable__EventExpired();
        }
    }
}
