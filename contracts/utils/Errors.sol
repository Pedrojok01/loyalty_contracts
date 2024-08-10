// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.20;

/**
 * @title Errors
 * @author @Pedrojok01
 * @notice Part of the Loyalty Platform
 * @dev Stores all the errors used in the contracts:
 * - saves gas;
 * - makes the code more readable;
 * - easier to maintain;
 */

contract Errors {
  // LoyaltyProgram
  error LoyaltyProgram__AlreadyMember();
  error LoyaltyProgram__InvalidPromotionType();
  error LoyaltyProgram__AmountVolumeIsZero();
  error LoyaltyProgram__AuthorizedFactoryOnly();
  error LoyaltyProgram__PromotionLimitReached();
  error LoyaltyProgram__LevelOutOfRange();
  error LoyaltyProgram__GetCurrentPromotionLimitFailed();

  // LoyaltyProgramFactory
  error LoyaltyProgramFactory__AlreadyExists();
  error LoyaltyProgramFactory__NameAlreadyTaken();
  error LoyaltyProgramFactory__InvalidIndex();
  error LoyaltyProgramFactory__AlreadyBlacklisted();
  error LoyaltyProgramFactory__NotBlacklisted();

  // RedeemableFactory
  error RedeemableFactory__TypeNotSupported();

  //NonExpirableFactory
  error NonExpirableFactory__TypeNotSupported();

  // CollectiblesFactory
  error CollectiblesFactory__TypeNotSupported();

  // BundlesFactory
  error BundlesFactory__TypeNotSupported();

  // Bundles
  error Bundles__MintToAddress0();
  error Bundles__ArraysDontMatch();
  error Bundles__NumbersDontMatch();
  error Bundles__MaxSupplyReached();
  error Bundles__EventExpired();
  error Bundles__CantSendZeroAmount();
  error Bundles__ValuesDontMatch();
  error Bundles__TokenNotOwned();
  error Bundles__TokenIdDoesntMatch();
  error Bundles__QueryForNonExistantToken();
  error Bundles__NotNeededHere();

  // Redeemable
  error Redeemable__TokenNotRedeemable(uint256 id);
  error Redeemable__TokenNotOwned();
  error Redeemable__WrongId();
  error Redeemable__WrongPromotionContract();
  error Redeemable__EventExpired();
  error Redeemable__ArraysDontMatch();
  error Redeemable__WrongValue();
  error Redeemable__NonExistantUser();
  error Redeemable__InsufficientLevel();
  error Redeemable__NotCalledFromContract();
  error Redeemable__InvalidDate();
  error Redeemable__NotOwnerOrApproved();

  // Collectibles
  error Collectibles__InvalidTokenId();
  error Collectibles__EventExpired();
  error Collectibles__NotCalledFromContract();
  error Collectibles__TooManyURIs();
  error Collectibles__InvalidDate();
  error Collectibles__InvalidAccountAddress();
  error Collectibles__MissingNFT();

  //NonExpirable
  error NonExpirable__InvalidMintType();
  error NonExpirable__NonExistantUser();
  error NonExpirable__InsufficientLevel();
  error NonExpirable__EventExpired();
  error NonExpirable__EventNotExpired();
  error NonExpirable__TicketNotOwned();
  error NonExpirable__NotOwnerOrApproved();
  error NonExpirable__TicketAlreadyUsed(uint256 ticketId);
  error NonExpirable__NotNeededHere();

  // Subscriptions
  error Subscriptions__TokenNotOwned();
  error Subscriptions__UserAlreadyOwnsSubscription();
  error Subscriptions__NoSubscriptionFound(uint256 tokenId);
  error Subscriptions__SubscriptionExpired();
  error Subscriptions__UpgradePlanBeforeRenewal();
  error Subscriptions__InvalidPlan();
  error Subscriptions__CannotDowngradeTier(); // to be deleted once implemented
  error Subscriptions__AlreadySubscribedToTier();
  error Subscriptions__IncorrectPrice();
  error Subscriptions__PaymentFailed();
  error Subscriptions__WithdrawalFailed();
  error Subscriptions__InvalidURIsLength();
  error Subscriptions__ExcessPaymentRefundFailed();

  // SubscriberChecks
  error SubscriberChecks__PleaseSubscribeFirst();
  error SubscriberChecks__PleaseSubscribeToProOrEnterpriseFirst();
  error SubscriberChecks__PleaseSubscribeToEnterpriseFirst();

  // TimeLimited
  error TimeLimited__TokenExpired();
  error TimeLimited__InvalidDate();

  // Activation
  error Activation__PromotionCurrentlyInactive();
  error Activation__PromotionCurrentlyActive();

  // Adminable
  error Adminable__UserNotRegistered();
  error Adminable__UserOptedOut();
  error Adminable__NotAuthorized();
  error Adminable__AddressZero();

  // AdminRegistry
  error AdminRegistry__NotAdmin();
  error AdminRegistry__AddressZero();
  error AdminRegistry__NotAuthorized();
  error AdminRegistry__UserOptedOut();
  error AdminRegistry__UserNotRegistered();
  error AdminRegistry__AdminAlreadySet();

  // Credits
  error Credits__InsufficientFunds();
  error Credits__InsufficientCredits();
  error Credits__InvalidArrayLength();
  error Credits__ErrorWhileRemovingCredit();
}
