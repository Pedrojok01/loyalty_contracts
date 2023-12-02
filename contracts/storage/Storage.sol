// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.20;

// import "hardhat/console.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Storage;
 * @author Pierre Estrabaud (@Pedrojok01)
 * @notice Part of the Loyalty Platform
 * @dev Independant contract that provides access to some constant values.
 * Allows to reduce the number of constructor arguments passed to every iherited contract.
 *
 */

contract Storage is Ownable {
  address private adminRegistryAddress;
  address private subscriptionControlAddress; // Subscriptions contract address

  error Storage_AddressZero();

  event AdminRegistryAddressChanged(address indexed newAddress);
  event SubscriptionControlAddressChanged(address indexed newAddress);

  constructor(address adminRegistry_, address subscription_, address owner_) Ownable(owner_) {
    if (adminRegistry_ == address(0) || subscription_ == address(0)) {
      revert Storage_AddressZero();
    }

    adminRegistryAddress = adminRegistry_;
    subscriptionControlAddress = subscription_;
  }

  function getAdminRegistry() public view returns (address) {
    return adminRegistryAddress;
  }

  function getSubscriptionControl() public view returns (address) {
    return subscriptionControlAddress;
  }

  function setAdminRegistry(address adminRegistry_) public onlyOwner {
    if (adminRegistry_ == address(0)) revert Storage_AddressZero();
    adminRegistryAddress = adminRegistry_;
    emit AdminRegistryAddressChanged(adminRegistry_);
  }

  function setSubscriptionControl(address subscription_) public onlyOwner {
    if (subscription_ == address(0)) revert Storage_AddressZero();
    subscriptionControlAddress = subscription_;
    emit SubscriptionControlAddressChanged(subscription_);
  }
}
