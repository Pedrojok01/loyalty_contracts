// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.19;

// import "hardhat/console.sol";
import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

import {TimeLimited} from "../utils/TimeLimited.sol";
import {SubscriberChecks} from "../subscriptions/SubscriberChecks.sol";
import {MeedProgram} from "../meedProgram/MeedProgram.sol";
import {Counters} from "../utils/Counters.sol";

/**
 * @title Collectibles
 * @author Pierre Estrabaud (@Pedrojok01)
 * @notice Part of the Meed Loyalty Platform from SuperUltra
 * @dev Collectibles are NFTs can be collected to win a reward.;
 *  - The whole collection must be collected for the reward to be unlocked;
 *  - The reward is decided by the brands, can be another NFT like super discount or free product;
 *  - The collected NFT are burned when used;
 */

contract Collectibles is ERC1155, TimeLimited {
  using Counters for Counters.Counter;

  MeedProgram private immutable meedProgram;
  uint256 private constant MAX_IDS = 64;
  Counters.Counter private _collectibleCounter;

  mapping(uint256 => string) private _uris;

  constructor(
    string[] memory uris,
    address _owner,
    uint256 _startDate,
    uint256 _expirationDate,
    address _meedProgram,
    address _subscriptionAddress,
    address adminRegistryAddress
  )
    ERC1155("")
    TimeLimited(_startDate, _expirationDate, _subscriptionAddress, adminRegistryAddress)
  {
    require(uris.length <= MAX_IDS, "CollectibleNFT: Too many URIs.");
    require(
      _expirationDate == 0 || _expirationDate > block.timestamp,
      "Collectibles: invalid date"
    );
    for (uint256 i = 0; i < uris.length; i++) {
      _uris[i] = uris[i];
      _mint(msg.sender, i, 1, "");
      meedProgram = MeedProgram(_meedProgram);
      transferOwnership(_owner);
    }
  }

  function uri(uint256 tokenId) public view override returns (string memory) {
    if (tokenId >= MAX_IDS) revert Collectibles__InvalidTokenId();
    return _uris[tokenId];
  }

  function mint(uint256 tokenId, address to, uint256 amount) public onlyOwner {
    if (tokenId >= MAX_IDS) revert Collectibles__InvalidTokenId();
    _mint(to, tokenId, amount, "");
  }

  function redeemReward(address account) public {
    require(account != address(0), "CollectibleNFT: Invalid account address.");
    for (uint256 i = 0; i < MAX_IDS; i++) {
      require(balanceOf(account, i) > 0, "CollectibleNFT: Missing NFT.");
    }

    for (uint256 i = 0; i < MAX_IDS; i++) {
      _burn(account, i, 1);
    }

    _collectibleCounter.increment();
    uint256 collectibleId = _collectibleCounter.current();
    _mint(account, collectibleId, 1, "");
  }

  /*///////////////////////////////////////////////////////////////////////////////
                                        PRIVATE
    ///////////////////////////////////////////////////////////////////////////////*/
}
