// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.18;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";

import {Counters} from "../utils/Counters.sol";
import {TimeLimited} from "../utils/TimeLimited.sol";
import {IExpirable} from "../interfaces/IExpirable.sol";
import {LoyaltyProgram} from "../loyaltyProgram/LoyaltyProgram.sol";

/**
 * @title Expirable
 * @author Pedrojok01
 * @notice Part of the Meed Rewards platform from SuperUltra
 * @dev ERC721 time limited NFT | Auto-burn at expiration:
 *  - Can either be airdrop to a specified membership level, or
 *  - Minted upon condition.
 */

/** TODO:
 *  - Add auto-burn mechanism
 */

contract Expirable is ERC721, IExpirable, TimeLimited {
    using Counters for Counters.Counter;

    /*///////////////////////////////////////////////////////////////////////////////
                                        STORAGE
    ///////////////////////////////////////////////////////////////////////////////*/

    string private _baseURIextended;
    LoyaltyProgram immutable loyaltyProgram;
    Counters.Counter private _tokenIdCounter;

    struct Ticket {
        bool used;
        address owner;
    }

    mapping(address => Ticket[]) private ticketsOwned;
    mapping(uint88 => Ticket) private tickets;

    constructor(
        string memory _name,
        string memory _symbol,
        string memory _uri,
        address _owner,
        uint256 _expirationDate,
        address _loyaltyProgram
    ) ERC721(_name, _symbol) TimeLimited(_expirationDate) {
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
                                    MINT / CONSUME
    ///////////////////////////////////////////////////////////////////////////////*/

    /**
     * @dev Mint a new NFT to a specified address
     * @param to Address to mint to; must be a member of the loyalty program;
     * @param lvlMin Level required to mint the NFT (set to 0 for no level requirement);
     */
    function safeMint(address to, uint256 lvlMin) external onlyOwnerOrAdmin onlyOngoing onlyActive {
        uint8 currentLevel = loyaltyProgram.getMemberLevel(to);
        if (currentLevel == 0) revert Expirable__NonExistantUser();
        if (currentLevel < uint8(lvlMin)) revert Expirable__InsufficientLevel();

        uint88 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();

        Ticket memory ticket = Ticket({used: false, owner: to});
        ticketsOwned[to].push(ticket);
        tickets[tokenId] = ticket;

        _safeMint(to, tokenId);
    }

    /**
     * @dev Mint a new NFT to a batch of specified addresses;
     * @param to Array of addresses to mint to; must be members of the loyalty program;
     * @param lvlMin Level required to mint the NFT (set to 0 for no level requirement);
     */
    function batchMint(address[] calldata to, uint8 lvlMin) external onlyOwnerOrAdmin onlyOngoing onlyActive {
        uint256 lentgh = to.length;
        for (uint256 i = 0; i < lentgh; i++) {
            this.safeMint(to[i], lvlMin);
        }
    }

    function consumeTiket(address from, uint256 ticketId) external onlyOngoing onlyActive {
        if (tickets[uint88(ticketId)].used) revert Expirable__TicketAlreadyUsed(ticketId);
        if (tickets[uint88(ticketId)].owner != from) revert Expirable__TicketNotOwned();

        tickets[uint88(ticketId)].used = true;
        _burn(ticketId);

        emit TicketConsumed(from, ticketId);
    }

    event TicketConsumed(address indexed from, uint256 ticketId);

    /*///////////////////////////////////////////////////////////////////////////////
                                        VIEW
    ///////////////////////////////////////////////////////////////////////////////*/

    function getTicketsPerAddress(address user) external view returns (Ticket[] memory) {
        return ticketsOwned[user];
    }

    function getTicket(uint256 ticketId) external view returns (Ticket memory) {
        return tickets[uint88(ticketId)];
    }

    /*///////////////////////////////////////////////////////////////////////////////
                                    INTERNAL / PRIVATE
    ///////////////////////////////////////////////////////////////////////////////*/

    /**
     * @dev Base URI for computing {tokenURI}. If set, the resulting URI for each
     * token will be the concatenation of the `baseURI` and the `tokenId`. Empty
     * by default, can be overridden in child contracts.
     */
    function _baseURI() internal view override returns (string memory) {
        return _baseURIextended;
    }

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
