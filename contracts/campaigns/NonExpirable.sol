// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";

import {Adminable} from "../utils/Adminable.sol";
import {Activation} from "../utils/Activation.sol";
import {INonExpirable} from "../interfaces/INonExpirable.sol";
import {SubscriberChecks} from "../subscriptions/SubscriberChecks.sol";
import {LoyaltyProgram} from "../loyaltyProgram/LoyaltyProgram.sol";
import {ICampaign} from "../interfaces/ICampaign.sol";

/**
 * @titleNonExpirable
 * @author Pedrojok01
 * @notice Part of the Loyalty Platform
 * @dev ERC721 time limited NFT | Auto-burn when used:
 *  - Can either be airdrop to a specified membership level, or
 *  - Minted upon condition.
 */

/**
 * Sighash   |   Function Signature
 * ================================
 * a1448194  =>  safeMint(address,uint256)
 * 1312b88f  =>  batchMint(address[],uint8)
 * fdc175f2  =>  consumeTiket(address,uint256)
 * fa5a3d81  =>  getTicketsPerAddress(address)
 * 7dc379fa  =>  getTicket(uint256)
 * 743976a0  =>  _baseURI()
 * 810bdd65  =>  _onlyOngoing()*
 */

contract NonExpirable is ERC721, INonExpirable, ICampaign, Adminable, Activation {
  /*///////////////////////////////////////////////////////////////////////////////
                                        STORAGE
    ///////////////////////////////////////////////////////////////////////////////*/

  string private _baseURIextended;
  LoyaltyProgram private immutable loyaltyProgram;
  uint40 private _tokenIdCounter;

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
    uint256 _data,
    address _loyaltyProgram,
    address _storageAddress
  ) ERC721(_name, _symbol) Adminable(_owner, _storageAddress) {
    _baseURIextended = _uri;
    loyaltyProgram = LoyaltyProgram(_loyaltyProgram);
    // transferOwnership(_owner);
  }

  /*///////////////////////////////////////////////////////////////////////////////
                                    MINT / CONSUME
    ///////////////////////////////////////////////////////////////////////////////*/

  /**
   * @dev Mint a new NFT to a specified address
   * @param to Address to mint to; must be a member of the loyalty program;
   * @param lvlMin Level required to mint the NFT (set to 0 for no level requirement);
   */
  function safeMint(address to, uint256 lvlMin) public onlyOwnerOrAdmin onlyProOrEnterprise {
    uint8 currentLevel = loyaltyProgram.getMemberLevel(to);
    if (currentLevel == 0) revert NonExpirable__NonExistantUser();
    if (currentLevel < uint8(lvlMin)) revert NonExpirable__InsufficientLevel();

    uint88 tokenId = _tokenIdCounter;
    _tokenIdCounter++;

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
  function batchMint(address[] calldata to, uint8 lvlMin) external onlyOwnerOrAdmin onlyEnterprise {
    uint256 lentgh = to.length;
    for (uint256 i = 0; i < lentgh; ) {
      safeMint(to[i], lvlMin);
      unchecked {
        i++;
      }
    }
  }

  /**
   * @dev Consume a ticket, burning it and marking it as used;
   * @param from Current owner of the ticket;
   * @param ticketId TicketId of the ticket to consume;
   */
  function consumeTiket(address from, uint256 ticketId) external {
    if (tickets[uint88(ticketId)].used) revert NonExpirable__TicketAlreadyUsed(ticketId);
    if (tickets[uint88(ticketId)].owner != from) revert NonExpirable__TicketNotOwned();

    tickets[uint88(ticketId)].used = true;
    _burn(ticketId);

    emit TicketConsumed(from, ticketId);
  }

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

  function autoMint(uint256 id, address to) external pure {
    // @todo implement conditional achievements system ?
    revert("Not needed in this contract");
  }

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

  function tokenURI(uint256 tokenId) public view override returns (string memory) {
    if (ownerOf(tokenId) != address(0)) return _baseURI();
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
