// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.20;

interface ISubscriptions {
  enum Plan {
    FREE,
    BASIC,
    PRO,
    ENTERPRISE
  }

  /**
   *  @notice Emitted when a subscription expiration changes
   *  @dev When a subscription is canceled, the expiration value should also be 0.
   */
  event SubscribedOrExtended(
    address indexed subscriber,
    uint256 indexed tokenId,
    uint64 expiration
  );

  /**
   *  @notice Emitted when a subscriber upgrade his subscription
   */
  event SubscriptionUpgraded(
    address indexed subscriber,
    uint256 tokenId,
    uint256 remainingTime,
    uint256 cost
  );

  /**
   * @dev Subscribe to Loyalty Rewards and emit a subscription NFT;
   * @param plan Chosen plan of the subscription (Basic, Pro, Enterprise)
   * @param duration Chosen duration of the subscription:
   *  - false = monthly (30 days);
   *  - true = anually (365 days);
   */
  function subscribe(Plan plan, bool duration) external payable;

  /**
   *  @notice Renews the subscription to an NFT
   *  Throws if `tokenId` is not a valid NFT
   *  @param tokenId The NFT to renew the subscription for
   *  @param duration The number of seconds to extend a subscription for
   */
  function renewSubscription(uint256 tokenId, Plan plan, bool duration) external payable;

  /**
   * @dev Change the plan of an existing subscription
   * @param tokenId the id of the subscription NFT
   * @param plan the chosen plan of the subscription (Basic, Pro, Enterprise)
   * @notice MUST be subscriber already
   */
  function changeSubscriptionPlan(uint256 tokenId, Plan plan) external payable;

  /**
   *  @notice Cancels the subscription of an NFT
   *  @dev Throws if `tokenId` is not a valid NFT
   *  @param tokenId The NFT to cancel the subscription for
   */
  function cancelSubscription(uint256 tokenId) external returns (bool);

  /**
   *  @notice Gets the expiration date of a subscription
   *  @dev Throws if `tokenId` is not a valid NFT
   *  @param tokenId The NFT to get the expiration date of
   *  @return The expiration date of the subscription
   */
  function expiresAt(uint256 tokenId) external view returns (uint64);

  /**
   *  @notice Determines whether a subscription can be renewed
   *  @dev Throws if `tokenId` is not a valid NFT
   *  @param tokenId The NFT to get the expiration date of
   *  @return The renewability of a the subscription
   */
  function isRenewable(uint256 tokenId) external view returns (bool);
}
