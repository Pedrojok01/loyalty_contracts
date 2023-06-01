// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.18;

import {Activation} from "../utils/Activation.sol";
import {Adminable} from "../utils/Adminable.sol";

/**
 * @title TimeLimited
 * @author Pierre Estrabaud (@Pedrojok01)
 * @notice Part of the Meed Loyalty Platform from SuperUltra
 * @dev Add a time limit mechanism to a contract, can be used with Activation;
 */

contract TimeLimited is Activation, Adminable {
  uint128 private startDate;
  uint128 private endDate; // 0 = no expiration

  constructor(
    uint256 _startDate,
    uint256 _endDate,
    address subscriptionsAddress,
    address adminRegistryAddress
  ) Adminable(adminRegistryAddress, subscriptionsAddress) {
    require(endDate == 0 || _startDate < _endDate, "TimeLimited: invalid dates");
    startDate = uint128(_startDate);
    endDate = uint128(_endDate);
  }

  /**
   * @dev !!! potential state change in this modifier !!!
   * Throws if the contract is expired.
   * Will automatically deactivate the contract if it is expired.
   */
  modifier onlyOngoing() virtual {
    _onlyOngoing();
    _;
  }

  /**
   * @dev Returns the start and end date of the contract.
   */
  function getValidityDate() external view returns (uint128 start, uint128 end) {
    start = startDate;
    end = endDate;
  }

  function isExpired() public view returns (bool) {
    if (endDate == 0) return false;
    else return block.timestamp >= endDate;
  }

  function updateExpirationDate(uint256 newExpirationDate) external onlyOwnerOrAdmin onlyActive {
    if (newExpirationDate < block.timestamp) revert NonExpirable__InvalidDate();
    uint128 oldDate = endDate;
    endDate = uint128(newExpirationDate);
    emit ExpirationDateUpdated(oldDate, uint128(newExpirationDate), _msgSender());
  }

  event ExpirationDateUpdated(
    uint128 newExpirationDate,
    uint128 oldExpirationDate,
    address indexed updater
  );

  function _onlyOngoing() internal virtual {
    if (isExpired()) {
      if (isActive()) {
        _deactivate();
      }
      revert TimeLimited__TokenExpired();
    }
  }
}
