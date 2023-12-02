// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.20;

/**
 * @title Interface for ICampaign.sol contract;
 * @author @Pedrojok01
 * @notice Part of the Loyalty Platform
 *
 * Contains functions common to all campaigns, so they can be called from a Loyalty program.
 * See specific interfaces for each campaign for specific functions.
 */

interface ICampaign {
  function autoMint(uint256 id, address to) external;

  function activatePromotion() external;

  function deactivatePromotion() external;
}
