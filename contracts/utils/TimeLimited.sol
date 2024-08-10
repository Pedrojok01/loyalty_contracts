// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.20;

import {Activation} from "../utils/Activation.sol";
import {Adminable} from "../utils/Adminable.sol";
import {IStorage} from "../interfaces/IStorage.sol";

/**
 * @title TimeLimited
 * @author @Pedrojok01
 * @notice Part of the Loyalty Platform
 * @dev Add a time limit mechanism to a contract, can be used with Activation;
 */

contract TimeLimited is Activation, Adminable {
  address private immutable SUBSCRIPTIONS_CONTRACT;
  uint128 private startDate;
  uint128 private endDate; // 0 = no expiration

  constructor(
    uint256 _startDate,
    uint256 _endDate,
    address _storageAddress,
    // solhint-disable-next-line no-unused-vars
    address owner_
  ) Adminable(owner_, _storageAddress) {
    if (endDate != 0 && _startDate >= _endDate) {
      revert TimeLimited__InvalidDate();
    }

    SUBSCRIPTIONS_CONTRACT = IStorage(_storageAddress).getSubscriptionControl();
    startDate = uint128(_startDate);
    endDate = uint128(_endDate);
  }

  /**
   * @dev Throws if the contract is expired.
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
    if (newExpirationDate < block.timestamp) revert TimeLimited__InvalidDate();
    _creditsCheck();
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
      revert TimeLimited__TokenExpired();
    }
  }

  function _creditsCheck() internal {
    if (_msgSender() == admin()) {
      (bool success, bytes memory result) = SUBSCRIPTIONS_CONTRACT.call(
        abi.encodeWithSignature("getUserCredits(address)", owner())
      );
      if (!success || abi.decode(result, (uint256)) < 1) {
        revert Credits__InsufficientCredits();
      } else {
        (bool removalSuccess, ) = SUBSCRIPTIONS_CONTRACT.call(
          abi.encodeWithSignature("_autoRemoveUserCredits(address)", owner())
        );
        if (!removalSuccess) revert Credits__ErrorWhileRemovingCredit();
      }
    }
  }
}
