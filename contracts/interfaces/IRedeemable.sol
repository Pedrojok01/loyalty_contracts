// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.18;

import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

/**
 * @title Interface for LoyaltyProgram.sol contract;
 * @author @Pedrojok01
 * @notice Part of the Loyal-T platform from SuperUltra
 * @dev Allows the factory to communicate with each game;
 */

interface IRedeemable is IERC165 {
    /*
     * ERC165 bytes to add to interface array - set in parent contract implementing this standard
     *
     * bytes4 private constant _INTERFACE_ID_ERC721REDEEM = 0x2f8ca953;
     */

    /// @dev This event emits when a token is redeemed.
    event Redeemed(address indexed from, uint256 indexed tokenId);

    /**
     * @notice Returns the redeem status of a token
     *  @param tokenId Identifier of the token.
     */
    function isRedeemable(uint256 tokenId) external view returns (bool);

    /**
     * @notice Redeeem a token;
     * @param tokenId Identifier of the token to redeeem;
     */
    function redeem(address from, uint256 tokenId, uint32 amount) external;
}
