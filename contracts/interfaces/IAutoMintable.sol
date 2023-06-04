// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.18;

/**
 * @title Interface for IAutoMintable.sol contract;
 * @author @Pedrojok01
 * @notice Part of the Meed Loyalty Platform from SuperUltra
 *
 * Allows the MeedProgram to autoMint vouchers when conditions are met.
 */

interface IAutoMintable {
  function autoMint(uint256 id, address to) external;
}
