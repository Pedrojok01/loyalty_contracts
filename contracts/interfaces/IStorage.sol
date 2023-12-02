// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IStorage {
  function getAdminRegistry() external view returns (address);

  function getSubscriptionControl() external view returns (address);
}
