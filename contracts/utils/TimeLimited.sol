// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.18;

import {Activation} from "../utils/Activation.sol";

/**
 * @title TimeLimited
 * @author Pierre Estrabaud (@Pedrojok01)
 * @notice Part of the Meed Loyalty Platform from SuperUltra
 * @dev Add a time limit mechanism to a contract, can be used with Activation;
 */

contract TimeLimited is Activation {
  uint128 private startDate;
  uint128 private endDate; // 0 = no expiration

  constructor(
    uint256 _startDate,
    uint256 _endDate,
    address _contractRole,
    address adminRegistryAddress
  ) Activation(_contractRole, adminRegistryAddress) {
    require(endDate == 0 || _startDate < _endDate, "TimeLimited: invalid dates");
    startDate = uint128(_startDate);
    endDate = uint128(_endDate);
  }

  modifier onlyOngoing() virtual {
    _onlyOngoing();
    _;
  }

  function getValidityDate() external view returns (uint128 start, uint128 end) {
    start = startDate;
    end = endDate;
  }

  function isExpired() external view returns (bool) {
    if (endDate == 0) return false;
    else return block.timestamp >= endDate;
  }

  function updateExpirationDate(uint256 newExpirationDate) external onlyOwnerOrAdmin onlyActive {
    if (newExpirationDate < block.timestamp) revert NonExpirable__InvalidDate();
    endDate = uint128(newExpirationDate);
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
