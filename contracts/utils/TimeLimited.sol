// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.18;

import {Activation} from "../utils/Activation.sol";

/**
 * @title TimeLimited
 * @author Pierre Estrabaud (@Pedrojok01)
 * @notice Part of the Meed Rewards platform from SuperUltra
 * @dev Add a time limit mechanism to a contract, can be used with Activation;
 */

contract TimeLimited is Activation {
    uint128 private startDate;
    uint128 private expirationDate; // 0 = no expiration

    constructor(uint256 _startDate, uint256 _expirationDate, address _contractRole) Activation(_contractRole) {
        startDate = uint128(_startDate);
        expirationDate = uint128(_expirationDate);
    }

    modifier onlyOngoing() virtual {
        _onlyOngoing();
        _;
    }

    function getExpirationDate() external view returns (uint256) {
        return expirationDate;
    }

    function isExpired() external view returns (bool) {
        return block.timestamp >= expirationDate;
    }

    function updateExpirationDate(uint256 newExpirationDate) external onlyOwnerOrAdmin onlyActive {
        if (newExpirationDate < block.timestamp) revert Expirable__InvalidDate();
        expirationDate = uint128(newExpirationDate);
        emit ExpirationDateUpdated(_msgSender(), newExpirationDate);
    }

    event ExpirationDateUpdated(address indexed updater, uint256 newExpirationDate);

    function _onlyOngoing() internal virtual {
        if (this.isExpired()) {
            if (this.isActive()) {
                this.deactivate();
            }
            revert TimeLimited__TokenExpired();
        }
    }
}
