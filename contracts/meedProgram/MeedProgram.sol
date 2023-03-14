// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.18;

// import "hardhat/console.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";

import {Adminable} from "../utils/Adminable.sol";
import {Counters} from "../utils/Counters.sol";
import {Activation} from "../utils/Activation.sol";
import {PromoLib} from "../library/PromoLib.sol";
import {IMeedProgram} from "../interfaces/IMeedProgram.sol";

/**
 * @title MeedProgram
 * @author Pedrojok01
 * @notice Part of the Meed Rewards platform from SuperUltra
 * @dev ERC721 Soulbound NFT with the following features:
 *  - Deployer can mint to recipients.
 *  - No transfer capability.
 */

/** TODO:
 *  - Add level system based on purchases
 *  - Add identity proof to ensure only one NFT per person?
 *  - Send unique NFT to brand creator to recognise him
 *
 */

contract MeedProgram is IMeedProgram, ERC721, ERC721Enumerable, Adminable {
    using Counters for Counters.Counter;
    using PromoLib for PromoLib.Data;

    /*///////////////////////////////////////////////////////////////////////////////
                                        STORAGE
    ///////////////////////////////////////////////////////////////////////////////*/

    bool public immutable TIER_TRACKER; // true = buyVolume, false = amountVolume
    string private _baseURIextended;
    Counters.Counter private _tokenIdCounter;
    PromoLib.Data private promoLib;
    address[3] private factories;

    struct TierStructure {
        uint64 silver;
        uint64 gold;
        uint64 platinum;
        uint64 diamond;
    }

    TierStructure public tierStructure;

    /**
     * @dev Store all data per member, fit in 1 storage slot
     */
    struct Membership {
        uint8 level; // 1 byte
        uint16 buyVolume; // 2 bytes (up to 65,535)
        uint32 amountVolume; // 4 bytes (up to 4,294,967,295)
        uint40 tokenId; // 5 bytes (up to 1,099,511,627,775)
        address owner; // 20 bytes
    }

    mapping(address => Membership) public membership;

    modifier onlyFactory() {
        _onlyFactory();
        _;
    }

    /**
     * @param _name NFT Name
     * @param _symbol NFT Symbol
     * @param _uri Token URI used for metadata
     */
    constructor(
        string memory _name,
        string memory _symbol,
        string memory _uri,
        bool _tierTracker,
        address _owner,
        uint64[4] memory amounts,
        address[3] memory _factories
    ) ERC721(_name, _symbol) {
        TIER_TRACKER = _tierTracker;
        _baseURIextended = _uri;
        factories = _factories;

        transferOwnership(_owner);
        _initializeTierStructure(amounts[0], amounts[1], amounts[2], amounts[3]);
        mint(_owner);
    }

    /*///////////////////////////////////////////////////////////////////////////////
                                        WRITE
    ///////////////////////////////////////////////////////////////////////////////*/

    /**
     * @dev An external method for the owner to mint Soulbound NFTs. Can only mint 1 per address.
     */
    function mint(address to) public onlyOwnerOrAdmin {
        if (membership[to].level != 0) {
            revert MeedProgram_AlreadyMember();
        }

        uint40 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();

        Membership memory newMembership = Membership({
            level: 1,
            buyVolume: 0,
            amountVolume: 0,
            tokenId: tokenId,
            owner: to
        });
        membership[to] = newMembership;

        _safeMint(to, tokenId);
    }

    function updateMember(address member, uint16 buyVolume, uint32 amountVolume) external onlyOwnerOrAdmin {
        if (membership[member].level == 0) {
            mint(member);
        }

        Membership memory memberData = membership[member];
        memberData.buyVolume += buyVolume;
        memberData.amountVolume += amountVolume;
        membership[member] = memberData;

        if (memberData.level != 5) {
            _updateMemberLevel(member, memberData);
        }
    }

    /*///////////////////////////////////////////////////////////////////////////////
                                        VIEW
    ///////////////////////////////////////////////////////////////////////////////*/

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        if (!_exists(tokenId)) revert MeedProgram_TokenDoesNotExist();
        return _baseURIextended;
    }

    /**
     * @dev Allows to get the level of a member
     */
    function isMember(address member) external view returns (bool) {
        return membership[member].owner == member;
    }

    /**
     * @dev Allows to get the level of a member
     */
    function getMemberLevel(address member) external view returns (uint8) {
        return membership[member].level;
    }

    function getAllPromotions() external view returns (PromoLib.Promotion[] memory allPromotions) {
        // return PromoLib._getAllPromotions(promoLib);
        return promoLib.promotions;
    }

    function getAllPromotionsPaging(
        uint256 offset,
        uint256 limit
    ) external view returns (PromoLib.Promotion[] memory pagedPromotions, uint256 nextOffset, uint256 total) {
        uint256 max_limit = 100;

        uint256 totalPromotions = promoLib.promotions.length;

        if (offset >= totalPromotions) {
            offset = 0;
        }
        if (limit == 0) {
            limit = 1;
        } else if (limit > max_limit) {
            limit = max_limit;
        }

        if (limit > totalPromotions - offset) {
            limit = totalPromotions - offset;
        }

        PromoLib.Promotion[] memory values = new PromoLib.Promotion[](limit);
        for (uint256 i = 0; i < limit; i++) {
            values[i] = promoLib.promotions[offset + i];
        }

        return (values, offset + limit, totalPromotions);
    }

    function getAllPromotionsPerType(
        PromoLib.PromotionsType _type
    ) external view returns (PromoLib.Promotion[] memory) {
        uint256 totalPromotions = promoLib.promotions.length;

        PromoLib.Promotion[] memory promotionsPerType = new PromoLib.Promotion[](totalPromotions);
        uint256 count = 0;

        for (uint256 i = 0; i < totalPromotions; i++) {
            if (promoLib.promotions[i].promotionsType == _type) {
                promotionsPerType[count] = promoLib.promotions[i];
                count++;
            }
        }

        // Resize the promotionsPerType array to the correct size
        assembly {
            mstore(promotionsPerType, count)
        }
        return promotionsPerType;
    }

    /**
     * @dev Allows to get all promotions per status
     * @param status The status of the promotion:
     *  - true = active
     *  - false = inactive
     * @return activePromotions An array of promotions
     */
    function getAllPromotionsPerStatus(bool status) external view returns (PromoLib.Promotion[] memory) {
        uint256 totalPromotions = promoLib.promotions.length;

        PromoLib.Promotion[] memory activePromotions = new PromoLib.Promotion[](totalPromotions);
        uint256 count = 0;

        for (uint256 i = 0; i < totalPromotions; i++) {
            if (promoLib.promotions[i].active == status) {
                activePromotions[count] = promoLib.promotions[i];
                count++;
            }
        }

        // Resize the promotionsPerType array to the correct size
        assembly {
            mstore(activePromotions, count)
        }

        return activePromotions;
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721Enumerable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    /*///////////////////////////////////////////////////////////////////////////////
                                        RESTRICTED
    ///////////////////////////////////////////////////////////////////////////////*/

    function switchStatus(address promotion, bool status) external onlyOwnerOrAdmin {
        PromoLib._setPromotionStatus(promotion, status, promoLib);
    }

    /**
     * @dev Updates the baseURI that will be used to retrieve NFT metadata.
     * @param baseURI_ The baseURI to be used.
     */
    function setBaseURI(string calldata baseURI_) external onlyOwnerOrAdmin {
        _baseURIextended = baseURI_;
    }

    /**
     * @dev Allows to add a promotion to the list of promotions (both array & mapping)
     * @param promotion The address of the loyalty program contract
     */
    function addPromotion(address promotion, PromoLib.PromotionsType _type) external onlyFactory {
        PromoLib._addPromotion(promotion, _type, promoLib);
    }

    /*///////////////////////////////////////////////////////////////////////////////
                                    INTERNAL / PRIVATE
    ///////////////////////////////////////////////////////////////////////////////*/

    function _initializeTierStructure(uint64 _amount1, uint64 _amount2, uint64 _amount3, uint64 _amount4) private {
        tierStructure = TierStructure({silver: _amount1, gold: _amount2, platinum: _amount3, diamond: _amount4});
    }

    function _updateMemberLevel(address _member, Membership memory _memberData) private {
        uint8 currentLevel = _memberData.level;
        uint8 newLevel;
        uint32 currentVolume = TIER_TRACKER ? uint32(_memberData.buyVolume) : _memberData.amountVolume;

        if (currentVolume >= tierStructure.diamond) {
            newLevel = 5;
        } else if (currentVolume >= tierStructure.platinum) {
            newLevel = 4;
        } else if (currentVolume >= tierStructure.gold) {
            newLevel = 3;
        } else if (currentVolume >= tierStructure.silver) {
            newLevel = 2;
        } else newLevel = currentLevel;

        if (newLevel != currentLevel) {
            _updateMemberLevelInternal(_member, newLevel);
        }
    }

    function _updateMemberLevelInternal(address _member, uint8 _newLevel) private {
        membership[_member].level = _newLevel;
        emit LevelUpdated(_member, _newLevel);
    }

    event LevelUpdated(address indexed member, uint8 level);

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 firstTokenId,
        uint256 batchSize
    ) internal override(ERC721, ERC721Enumerable) {
        super._beforeTokenTransfer(from, to, firstTokenId, batchSize);
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseURIextended;
    }

    function _onlyFactory() private view {
        if (_msgSender() != factories[0] && _msgSender() != factories[1] && _msgSender() != factories[2]) {
            revert MeedProgram_NotAuthorized();
        }
    }
}
