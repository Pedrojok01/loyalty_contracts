// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.18;

/**
 * @title Interface for LoyaltyProgram.sol contract;
 * @author @Pedrojok01
 * @notice Part of the Loyal-T platform from SuperUltra
 * @dev Allows the factory to communicate with each game;
 */

interface ILoyaltyProgram {
    /**
     * @dev An external method for the owner to mint Soulbound NFTs. Can only mint 1 per address.
     */
    function mint() external;

    // Declare a function to get the level of an NFT
    function getLevel() external view returns (uint256);

    /**
     * @dev Updates the baseURI that will be used to retrieve NFT metadata.
     * @param baseURI_ The baseURI to be used.
     */
    function setBaseURI(string calldata baseURI_) external;
}
