// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.20;

library PromoDataLib {
  struct BundlesPromoData {
    uint256 _startDate;
    uint256 _expirationDate;
    uint256 _maxLimit;
    address _loyaltyProgram;
    address _owner;
  }
}
