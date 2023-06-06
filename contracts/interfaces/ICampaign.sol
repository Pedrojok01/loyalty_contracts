// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.18;

/**
 * @title Interface for ICampaign.sol contract;
 * @author @Pedrojok01
 * @notice Part of the Meed Loyalty Platform from SuperUltra
 *
 * Contains functions common to all campaigns, so they can be called from a Meed program.
 * See specific interfaces for each campaign for specific functions.
 */

interface ICampaign {
  function autoMint(uint256 id, address to) external;

  function activatePromotion() external;

  function deactivatePromotion() external;
}
