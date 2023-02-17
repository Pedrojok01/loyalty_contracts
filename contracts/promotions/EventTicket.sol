// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.18;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {Pausable} from "@openzeppelin/contracts/security/Pausable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {Counters} from "../utils/Counters.sol";

/**
 * @title EventTicket
 * @author Pedrojok01
 * @notice Part of the Loyal-T platform from SuperUltra
 * @dev ERC721 Soulbound NFT | Auto-burn at expiration:
 *  - Can either be airdrop to a specified membership level, or
 *  - Minted upon condition.
 */

/** TODO:
 *  - Add expiration date
 *  - Add auto-burn mechanism
 *  - Handle require condition to mint
 *
 */

contract EventTicket is ERC721, ERC721Enumerable, Pausable, Ownable {
    using Counters for Counters.Counter;

    /*///////////////////////////////////////////////////////////////////////////////
                                        STORAGE
    ///////////////////////////////////////////////////////////////////////////////*/

    address private immutable ADMIN;
    string private _baseURIextended;
    uint32 public expirationDate;
    Counters.Counter private _tokenIdCounter;

    struct Ticket {
        bool used;
        bool sold;
        address owner;
    }

    mapping(address => Ticket[]) public ticketsOwned;
    mapping(uint88 => Ticket) public tickets;

    event Attest(address indexed to, uint256 indexed tokenId);
    event Revoke(address indexed to, uint256 indexed tokenId);

    constructor(
        string memory _name,
        string memory _symbol,
        string memory _uri,
        uint32 _expirationDate,
        address _owner,
        address _admin
    ) ERC721(_name, _symbol) {
        ADMIN = _admin;
        _baseURIextended = _uri;
        expirationDate = _expirationDate;
        transferOwnership(_owner);
    }

    /*///////////////////////////////////////////////////////////////////////////////
                                    MINT / BURN
    ///////////////////////////////////////////////////////////////////////////////*/

    function safeMint(address to, uint8 mintType) external whenNotPaused {
        // Add contract state: actif / inactif and use revert instead of require ???
        require(expirationDate > block.timestamp, "EventTicket: event expired");
        require(mintType == 0 || mintType == 1, "EventTicket: invalid mint type");
        // admin if airdrop, membership level if on-demand mint
        uint88 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();

        Ticket memory ticket = Ticket({used: false, sold: false, owner: to});
        ticketsOwned[to].push(ticket);
        tickets[tokenId] = ticket;

        _safeMint(to, tokenId);
    }

    function burn(uint256 tokenId) external {
        require(this.isEventExpired(), "EventTicket: event not yet expired");
        require(ownerOf(tokenId) == msg.sender, "EventTicket: Only owner");
        _burn(tokenId);
    }

    /*///////////////////////////////////////////////////////////////////////////////
                                    TRANSFERS
    ///////////////////////////////////////////////////////////////////////////////*/

    function transferFrom(address from, address to, uint256 tokenId) public override(ERC721) whenNotPaused {
        super.transferFrom(from, to, tokenId);
    }

    /**
     * @dev See {IERC721-transferFrom}.
     */
    function safeTransferFrom(address from, address to, uint256 tokenId) public override(ERC721) whenNotPaused {
        super.safeTransferFrom(from, to, tokenId, "");
    }

    /**
     * @dev See {IERC721-safeTransferFrom}.
     */
    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        bytes memory data
    ) public override(ERC721, IERC721) whenNotPaused {
        require(_isApprovedOrOwner(_msgSender(), tokenId), "ERC721: Not owner or approved");
        _safeTransfer(from, to, tokenId, data);
    }

    /*///////////////////////////////////////////////////////////////////////////////
                                        VIEW
    ///////////////////////////////////////////////////////////////////////////////*/

    function isEventExpired() external view returns (bool isExpired) {
        return expirationDate >= block.timestamp;
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721Enumerable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    /*///////////////////////////////////////////////////////////////////////////////
                                        RESTRICTED
    ///////////////////////////////////////////////////////////////////////////////*/

    /**
     * @dev Update the event date;
     */
    function updateEventDate(uint32 newEventDate) external whenNotPaused onlyOwner {
        require(expirationDate > block.timestamp, "EventTicket: event expired");
        expirationDate = newEventDate;
    }

    /**
     * @dev Set the event status as expired;
     */
    function setEventAsExpired() external onlyOwner {
        require(this.isEventExpired(), "EventTicket: event not yet expired");
        _pause();
    }

    /*///////////////////////////////////////////////////////////////////////////////
                                    INTERNAL / PRIVATE
    ///////////////////////////////////////////////////////////////////////////////*/

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal override(ERC721, ERC721Enumerable) {
        require(from == address(0) || to == address(0), "You cannot transfer this token");
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }

    function _afterTokenTransfer(address from, address to, uint256 tokenId) internal {
        if (from == address(0)) {
            emit Attest(to, tokenId);
        } else if (to == address(0)) {
            emit Revoke(to, tokenId);
        }
    }

    function _burn(uint256 tokenId) internal override {
        super._burn(tokenId);
    }

    /**
     * @dev Base URI for computing {tokenURI}. If set, the resulting URI for each
     * token will be the concatenation of the `baseURI` and the `tokenId`. Empty
     * by default, can be overridden in child contracts.
     */
    function _baseURI() internal view override returns (string memory) {
        return _baseURIextended;
    }
}
