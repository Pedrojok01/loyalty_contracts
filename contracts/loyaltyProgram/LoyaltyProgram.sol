// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.18;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/security/Pausable.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";

import {Counters} from "../utils/Counters.sol";
import {ILoyaltyProgram} from "../interfaces/ILoyaltyProgram.sol";

/**
 * @title LoyaltyProgram
 * @author Pedrojok01
 * @notice Part of the Loyal-T platform from SuperUltra
 * @dev ERC721 Soulbound NFT with the following features:
 *  - Deployer can mint to recipients.
 *  - No transfer capability.
 */

/** TODO:
 *  - Add level system based on purchases
 *  - Send unique NFT to brand creator to recognise him
 *  - Add special function to differentiate our NFT from others
 *
 */

contract LoyaltyProgram is ILoyaltyProgram, ERC721, ERC721Enumerable, Pausable, Ownable {
    using Counters for Counters.Counter;

    /*///////////////////////////////////////////////////////////////////////////////
                                        STORAGE
    ///////////////////////////////////////////////////////////////////////////////*/

    bytes32 public immutable PRODUCT_TYPE;
    string private _baseURIextended;
    Counters.Counter private _tokenIdCounter;

    struct Membership {
        uint8 level;
        uint88 tokenId;
        address owner;
    }

    mapping(address => Membership) public membership;

    /**
     * @param _name NFT Name
     * @param _symbol NFT Symbol
     * @param _uri Token URI used for metadata
     */
    constructor(
        string memory _name,
        string memory _symbol,
        string memory _uri,
        address _owner,
        bytes32 _productType
    ) ERC721(_name, _symbol) {
        PRODUCT_TYPE = _productType;
        _baseURIextended = _uri;
        transferOwnership(_owner);
        pause();
    }

    /*///////////////////////////////////////////////////////////////////////////////
                                        MINT
    ///////////////////////////////////////////////////////////////////////////////*/

    /**
     * @dev An external method for the owner to mint Soulbound NFTs. Can only mint 1 per address.
     */
    function mint() external {
        address member = _msgSender();
        // require(balanceOf(member) == 0, "LoyaltyProgram: Already owned");
        require(membership[member].level == 0, "LoyaltyProgram: Already owned");

        uint88 tokenId = _tokenIdCounter.current();

        Membership memory newMembership = Membership({level: 1, tokenId: tokenId, owner: member});
        membership[member] = newMembership;

        uint256 ts = totalSupply();
        _safeMint(member, ts);
    }

    /*///////////////////////////////////////////////////////////////////////////////
                                        VIEW
    ///////////////////////////////////////////////////////////////////////////////*/
    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721Enumerable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    // Declare a function to get the level of an NFT
    function getLevel() external view returns (uint256) {
        return membership[_msgSender()].level;
    }

    /*///////////////////////////////////////////////////////////////////////////////
                                        RESTRICTED
    ///////////////////////////////////////////////////////////////////////////////*/

    /**
     * @dev Updates the baseURI that will be used to retrieve NFT metadata.
     * @param baseURI_ The baseURI to be used.
     */
    function setBaseURI(string calldata baseURI_) external onlyOwner {
        _baseURIextended = baseURI_;
    }

    /*///////////////////////////////////////////////////////////////////////////////
                                    INTERNAL / PRIVATE
    ///////////////////////////////////////////////////////////////////////////////*/

    /**
     * @dev Pauses the NFT, preventing any transfers. Called by default on a SBT.
     */
    function pause() internal {
        _pause();
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 firstTokenId,
        uint256 batchSize
    ) internal override(ERC721, ERC721Enumerable) {
        require(_msgSender() == owner() && paused(), "LoyaltyProgram: Not owner");
        super._beforeTokenTransfer(from, to, firstTokenId, batchSize);
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseURIextended;
    }
}
