// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.20;

// import "hardhat/console.sol";
import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

import {TimeLimited} from "../utils/TimeLimited.sol";
import {LoyaltyProgram} from "../loyaltyProgram/LoyaltyProgram.sol";
import {ICampaign} from "../interfaces/ICampaign.sol";

/**
 * @title Collectibles
 * @author Pierre Estrabaud (@Pedrojok01)
 * @notice Part of the Loyalty Platform
 * @dev Collectibles are NFTs can be collected to win a reward.;
 *  - The whole collection must be collected for the reward to be unlocked;
 *  - The reward is decided by the brands, can be another NFT like super discount or free product;
 *  - The collected NFT are burned when used;
 */

contract Collectibles is ERC1155, ICampaign, TimeLimited {
  LoyaltyProgram private immutable loyaltyProgram;
  uint256 private constant MAX_IDS = 64;
  uint40 private _collectibleCounter;

  mapping(uint256 => string) private _uris;

  constructor(
    string[] memory uris,
    address _owner,
    uint256 _startDate,
    uint256 _expirationDate,
    address _loyaltyProgram,
    address _storageAddress
  ) ERC1155("") TimeLimited(_startDate, _expirationDate, _storageAddress, _owner) {
    require(uris.length <= MAX_IDS, "CollectibleNFT: Too many URIs.");
    require(
      _expirationDate == 0 || _expirationDate > block.timestamp,
      "Collectibles: invalid date"
    );
    for (uint256 i = 0; i < uris.length; i++) {
      _uris[i] = uris[i];
    }
    loyaltyProgram = LoyaltyProgram(_loyaltyProgram);
    // transferOwnership(_owner);
  }

  function uri(uint256 tokenId) public view override returns (string memory) {
    if (tokenId >= MAX_IDS) revert Collectibles__InvalidTokenId();
    return _uris[tokenId];
  }

  function mint(uint256 tokenId, address to) public onlyOwnerOrAdmin onlyOngoing onlyActive {
    if (_msgSender() == admin()) {
      _onlySubscribers(owner());
    }

    if (tokenId >= MAX_IDS) revert Collectibles__InvalidTokenId();
    _mint(to, tokenId, 1, "");
  }

  /**
    @dev Limited mint - only the owner can mint the level 2 and above NFTs;
    @param id Allow to choose the kind of NFT to be minted;
    @param to Address which will receive the limited NFTs;
    */
  function autoMint(uint256 id, address to) external onlyOngoing onlyActive {
    if (_msgSender() != address(loyaltyProgram)) revert Collectibles__NotCalledFromContract();
    _onlySubscribers(owner());

    if (id >= MAX_IDS) revert Collectibles__InvalidTokenId();
    _mint(to, id, 1, "");
  }

  function redeemReward(address account) public {
    require(account != address(0), "CollectibleNFT: Invalid account address.");
    for (uint256 i = 0; i < MAX_IDS; i++) {
      require(balanceOf(account, i) > 0, "CollectibleNFT: Missing NFT.");
    }

    for (uint256 i = 0; i < MAX_IDS; i++) {
      _burn(account, i, 1);
    }

    _collectibleCounter++;
    uint256 collectibleId = _collectibleCounter;
    _mint(account, collectibleId, 1, "");
  }

  /**
   * @dev Allows to activate a promotion
   */
  function activatePromotion() external onlyOwnerOrAdmin {
    _activate(address(this));
  }

  /**
   * @dev Allows to deactivate a promotion
   */
  function deactivatePromotion() external onlyOwnerOrAdmin {
    _deactivate(address(this));
  }

  /*///////////////////////////////////////////////////////////////////////////////
                                        PRIVATE
    ///////////////////////////////////////////////////////////////////////////////*/
}
