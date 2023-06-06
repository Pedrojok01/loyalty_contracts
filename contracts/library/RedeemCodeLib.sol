// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.19;

/**
 * @title RedeemCodeLib
 * @author Pierre Estrabaud (@Pedrojok01)
 * @notice Part of the Meed Loyalty Platform from SuperUltra
 * @dev Provides "random" redeem code getter and setter for all promotion's vouchers.
 *
 * using RedeemCodeLib for RedeemCodeLib.RedeemCodeStorage;
    RedeemCodeLib.RedeemCodeStorage internal redeemCodeStorage;
 */

import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {Counters} from "../utils/Counters.sol";

library RedeemCodeLib {
  using Strings for uint256;
  using Counters for Counters.Counter;

  struct Voucher {
    address contractAddress;
    uint256 tokenID;
  }

  struct RedeemCodeStorage {
    mapping(string => Voucher) redeemCodes;
    Counters.Counter codeIndex;
  }

  function getDataFromRedeemCode(
    RedeemCodeStorage storage self,
    string memory code
  ) public view returns (address, uint256) {
    Voucher storage voucher = self.redeemCodes[code];
    require(voucher.contractAddress != address(0), "Invalid redeem code");

    return (voucher.contractAddress, voucher.tokenID);
  }

  function generateRedeemCode(
    RedeemCodeStorage storage self,
    address _contractAddress,
    uint256 _tokenID
  ) internal returns (string memory) {
    uint256 index = self.codeIndex.current();
    string memory code = generateUniqueCode(index);

    Voucher storage voucher = self.redeemCodes[code];
    require(voucher.contractAddress == address(0), "Redeem code already exists");

    voucher.contractAddress = _contractAddress;
    voucher.tokenID = _tokenID;

    self.codeIndex.increment();

    return code;
  }

  function generateUniqueCode(uint256 index) private pure returns (string memory) {
    bytes32 hash = keccak256(abi.encodePacked(index));
    bytes memory codeBytes = new bytes(6);

    uint256 letterIndex = 0;
    for (uint256 i = 0; i < 2; ) {
      uint8 letter = (uint8(hash[i]) % 26) + 65;
      codeBytes[letterIndex] = bytes1(letter);
      letterIndex++;
      unchecked {
        i++;
      }
    }

    for (uint256 i = 2; i < 6; ) {
      uint8 digit = (uint8(hash[i]) % 10) + 48;
      codeBytes[letterIndex] = bytes1(digit);
      letterIndex++;
      unchecked {
        i++;
      }
    }

    return string(codeBytes);
  }
}
