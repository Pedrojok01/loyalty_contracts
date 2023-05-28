// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.18;

/**
 * @title Errors
 * @author Pierre Estrabaud (@Pedrojok01)
 * @notice Part of the Meed Loyalty Platform from SuperUltra
 * @dev Stores all the errors used in the contracts:
 * - saves gas;
 * - makes the code more readable;
 * - easier to maintain;
 */

contract Errors {
    // MeedProgram
    error MeedProgram_AlreadyMember();
    error MeedProgram_InvalidPromotionType();
    error MeedProgram_TokenDoesNotExist();
    error MeedProgram_NotAuthorized();

    // MeedProgramFactory
    error MeedProgramFactory_AlreadyExists();
    error MeedProgramFactory_NameAlreadyTaken();

    // RedeemableFactory
    error RedeemableFactory_TypeNotSupported();

    //NonExpirableFactory
    error NonExpirableFactory_TypeNotSupported();

    // CollectiblesFactory
    error CollectiblesFactory_TypeNotSupported();

    // BundlesFactory
    error BundlesFactory_TypeNotSupported();

    // Bundles
    error Bundles__MintToAddress0();
    error Bundles__ArraysDontMatch();
    error Bundles__NumbersDontMatch();
    error Bundles__MaxSupplyReached();
    error Bundles__EventExpired();
    error Bundles__CantSendZeroAmount();
    error Bundles__ValuesDontMatch();
    error Bundles__TokenNotOwned();
    error Bundles__TokenURIQueryForNonexistentToken();
    error Bundles__TokenIdDoesntMatch();

    // Redeemable
    error Redeemable__TokenNotRedeemable(uint256 id);
    error Redeemable__TokenNotOwned();
    error Redeemable__WrongType();
    error Redeemable__WrongId();
    error Redeemable__WrongPromotionContract();
    error Redeemable__WrongLevel();
    error Redeemable__EventExpired();
    error Redeemable__ArraysDontMatch();
    error Redeemable__WrongValue();
    error Redeemable__NonExistantUser();
    error Redeemable__InsufficientLevel();

    // Collectibles
    error Collectibles__InvalidTokenId();
    error Collectibles__EventExpired();

    //NonExpirable
    error NonExpirable__InvalidMintType();
    error NonExpirable__InvalidDate();
    error NonExpirable__NonExistantUser();
    error NonExpirable__InsufficientLevel();
    error NonExpirable__EventExpired();
    error NonExpirable__EventNotExpired();
    error NonExpirable__TicketNotOwned();
    error NonExpirable__NotOwnerOrApproved();
    error NonExpirable__TicketAlreadyUsed(uint256 ticketId);

    // Subscriptions
    error Subscriptions__TokenNotOwned();
    error Subscriptions__UserAlreadyOwnsSubscription();
    error Subscriptions__NoSubscriptionFound();
    error Subscriptions__SubscriptionExpired();
    error Subscriptions__UpgradePlanBeforeRenewal();
    error Subscriptions__InvalidPlan();
    error Subscriptions__CannotDowngradeTier(); // to be deleted once implemented
    error Subscriptions__AlreadySubscribedToTier();
    error Subscriptions__IncorrectPrice();
    error Subscriptions__PaymentFailed();
    error Subscriptions__WithdrawToAddressZero();
    error Subscriptions__WithdrawalFailed();
    error Subscriptions__PleaseUpgradeYourPlan();

    // SubscriberChecks
    error SubscriberChecks__PleaseSubscribeFirst();
    error SubscriberChecks__PleaseSubscribeToProOrEnterpriseFirst();
    error SubscriberChecks__PleaseSubscribeToEnterpriseFirst();

    // TimeLimited
    error TimeLimited__TokenExpired();

    // Activation
    error Activation__PromotionCurrentlyInactive();
    error Activation__PromotionCurrentlyActive();
    error Activation__NotAuthorized();

    // Adminable
    error Adminable__NotAdmin();
    error Adminable__AddressZero();
    error Adminable__NotAuthorized();
    error Adminable__AdminAlreadySet();
}
