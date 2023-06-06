// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.19;

/**
 * @title Interface for NonExpirable.sol contract;
 * @author @Pedrojok01
 * @notice Part of the Meed Loyalty Platform from SuperUltra
 */

interface INonExpirable {
  event TicketConsumed(address indexed from, uint256 ticketId);

  /**
   * @dev Mint a new NFT to a specified address
   * @param to Address to mint to; must be a member of the loyalty program;
   * @param lvlMin Level required to mint the NFT (set to 0 for no level requirement);
   */
  function safeMint(address to, uint256 lvlMin) external;

  /**
   * @dev Mint a new NFT to a batch of specified addresses;
   * @param to Array of addresses to mint to; must be members of the loyalty program;
   * @param lvlMin Level required to mint the NFT (set to 0 for no level requirement);
   */
  function batchMint(address[] calldata to, uint8 lvlMin) external;

  /**
   * @dev Consume a ticket, burning it and marking it as used;
   * @param from Current owner of the ticket;
   * @param ticketId TicketId of the ticket to consume;
   */
  function consumeTiket(address from, uint256 ticketId) external;
}
