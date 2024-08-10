require("@nomicfoundation/hardhat-chai-matchers");
import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";

import { deploy } from "./helpers/deploy";
import { ethers } from "hardhat";
import { duration, plan, pricePerPlan, promoType, subscriptions_uris } from "./helpers/constant";

describe("Activation Feature", function () {
  async function deployFixture() {
    const {
      adminRegistry,
      subscriptions,
      loyaltyProgramFactory,
      redeemableFactory,
      collectiblesFactory,
      nonExpirableFactory,
      loyaltyProgram,
      expirationDate,
      owner,
      user1,
      user2,
      user3,
      admin,
    } = await deploy();

    // Create a new promo via the redeemable factory
    const startDate = Math.floor(Date.now() / 1000).toString();
    const loyaltyProgramAddress = await loyaltyProgram.getAddress();

    await redeemableFactory.instance.createNewPromotion(
      "ipfs://uri",
      startDate,
      expirationDate,
      loyaltyProgramAddress,
      promoType.freeProducts, // 1
    );

    // Check the new state  (1 promo)
    const allPromos = await loyaltyProgram.getAllPromotions();
    expect(allPromos.length).to.equal(1);

    const redeemable = await ethers.getContractAt("Redeemable", allPromos[0].promotionAddress);

    return {
      adminRegistry,
      subscriptions,
      loyaltyProgramFactory,
      redeemableFactory,
      collectiblesFactory,
      nonExpirableFactory,
      loyaltyProgram,
      redeemable,
      expirationDate,
      owner,
      user1,
      user2,
      user3,
      admin,
    };
  }

  it("should be activated by default", async () => {
    const { redeemable } = await loadFixture(deployFixture);

    expect(await redeemable.isActive()).to.equal(true);
  });

  it("shouldn't be possible to deactivate a promo if not authorized", async () => {
    const { loyaltyProgram, redeemable, user1, admin } = await loadFixture(deployFixture);
    const redeemableAddress = await redeemable.getAddress();

    expect(await redeemable.isActive()).to.equal(true);

    // revert if not owner or admin
    await expect(
      loyaltyProgram.connect(user1).deactivatePromotion(redeemableAddress),
    ).to.be.revertedWithCustomError(loyaltyProgram, "Adminable__NotAuthorized");

    // revert if admin but owner not subscriber
    await expect(
      loyaltyProgram.connect(admin).deactivatePromotion(redeemableAddress),
    ).to.be.revertedWithCustomError(loyaltyProgram, "SubscriberChecks__PleaseSubscribeFirst");

    expect(await redeemable.isActive()).to.equal(true); // still true
  });

  it("should be possible to deactivate a promo if owner", async () => {
    const { loyaltyProgram, redeemable, owner, user1 } = await loadFixture(deployFixture);
    const redeemableAddress = await redeemable.getAddress();

    // Check the current state  (1 promo)
    const newPromos = await loyaltyProgram.getAllPromotions();
    expect(newPromos[0].active).to.equal(true);
    const activesBefore = await loyaltyProgram.getAllPromotionsPerStatus(true);
    expect(activesBefore.length).to.equal(1);
    const inactivesBefore = await loyaltyProgram.getAllPromotionsPerStatus(false);
    expect(inactivesBefore.length).to.equal(0);

    expect(await redeemable.isActive()).to.equal(true);

    const receipt = await loyaltyProgram.deactivatePromotion(redeemableAddress);
    await expect(receipt)
      .to.emit(redeemable, "Deactivated")
      .withArgs(owner.address, redeemableAddress);

    expect(await redeemable.isActive()).to.equal(false); // deactivated

    const promoUpdated = await loyaltyProgram.getAllPromotions();
    expect(promoUpdated[0].active).to.equal(false);
    const activesAfter = await loyaltyProgram.getAllPromotionsPerStatus(true);
    expect(activesAfter.length).to.equal(0);
    const inactivesAfter = await loyaltyProgram.getAllPromotionsPerStatus(false);
    expect(inactivesAfter.length).to.equal(1);

    // revert if not owner or admin
    await expect(
      loyaltyProgram.connect(user1).activatePromotion(redeemableAddress),
    ).to.be.revertedWithCustomError(loyaltyProgram, "Adminable__NotAuthorized");

    const receipt2 = await loyaltyProgram.activatePromotion(redeemableAddress);
    await expect(receipt2)
      .to.emit(redeemable, "Activated")
      .withArgs(owner.address, redeemableAddress);

    expect(await redeemable.isActive()).to.equal(true); // reactivated
  });

  it("should be possible to deactivate a promo if admin and owner subscribed", async () => {
    const { subscriptions, loyaltyProgram, redeemable, admin } = await loadFixture(deployFixture);
    const redeemableAddress = await redeemable.getAddress();

    // Check the current state  (1 promo)
    const newPromos = await loyaltyProgram.getAllPromotions();
    expect(newPromos[0].active).to.equal(true);
    const activesBefore = await loyaltyProgram.getAllPromotionsPerStatus(true);
    expect(activesBefore.length).to.equal(1);
    const inactivesBefore = await loyaltyProgram.getAllPromotionsPerStatus(false);
    expect(inactivesBefore.length).to.equal(0);

    expect(await redeemable.isActive()).to.equal(true);

    // revert if admin but owner not subscriber
    await expect(
      loyaltyProgram.connect(admin).deactivatePromotion(redeemableAddress),
    ).to.be.revertedWithCustomError(loyaltyProgram, "SubscriberChecks__PleaseSubscribeFirst");

    // Owner subscribes and then deactivates via admin
    await subscriptions.instance.subscribe(plan.enterprise, false, {
      value: pricePerPlan.enterprise,
    });

    const receipt = await loyaltyProgram.connect(admin).deactivatePromotion(redeemableAddress);
    await expect(receipt)
      .to.emit(redeemable, "Deactivated")
      .withArgs(admin.address, redeemableAddress);

    expect(await redeemable.isActive()).to.equal(false); // deactivated

    const promoUpdated = await loyaltyProgram.getAllPromotions();
    expect(promoUpdated[0].active).to.equal(false);
    const activesAfter = await loyaltyProgram.getAllPromotionsPerStatus(true);
    expect(activesAfter.length).to.equal(0);
    const inactivesAfter = await loyaltyProgram.getAllPromotionsPerStatus(false);
    expect(inactivesAfter.length).to.equal(1);

    const receipt2 = await loyaltyProgram.connect(admin).activatePromotion(redeemableAddress);
    await expect(receipt2)
      .to.emit(redeemable, "Activated")
      .withArgs(admin.address, redeemableAddress);

    expect(await redeemable.isActive()).to.equal(true); // reactivated
  });

  it("shouldn't be possible to deactivate a promo if already deactivate", async () => {
    const { loyaltyProgram, redeemable, owner } = await loadFixture(deployFixture);
    const redeemableAddress = await redeemable.getAddress();

    expect(await redeemable.isActive()).to.equal(true);

    // revert because already activated
    await expect(loyaltyProgram.activatePromotion(redeemableAddress)).to.be.revertedWithCustomError(
      redeemable,
      "Activation__PromotionCurrentlyActive",
    );

    const receipt = await loyaltyProgram.deactivatePromotion(redeemableAddress);
    await expect(receipt)
      .to.emit(redeemable, "Deactivated")
      .withArgs(owner.address, redeemableAddress);

    expect(await redeemable.isActive()).to.equal(false); // deactivated

    // revert because already deactivated
    await expect(
      loyaltyProgram.deactivatePromotion(redeemableAddress),
    ).to.be.revertedWithCustomError(redeemable, "Activation__PromotionCurrentlyInactive");
  });

  it("shouldn't be possible to update the expiration date if inactive", async () => {
    const { loyaltyProgram, redeemable, owner } = await loadFixture(deployFixture);
    const redeemableAddress = await redeemable.getAddress();

    // deactivate promo
    const receipt = await loyaltyProgram.deactivatePromotion(redeemableAddress);
    await expect(receipt)
      .to.emit(redeemable, "Deactivated")
      .withArgs(owner.address, redeemableAddress);

    expect(await redeemable.isActive()).to.equal(false); // deactivated
    expect(await loyaltyProgram.getPromotionStatus(redeemableAddress)).to.equal(false);

    // Update expiration date (revert if inactive):
    const newExpirationDate = (Math.floor(Date.now() / 1000) + duration.year * 3).toString();
    await expect(redeemable.updateExpirationDate(newExpirationDate)).to.be.revertedWithCustomError(
      redeemable,
      "Activation__PromotionCurrentlyInactive",
    );
  });

  it("shouldn't expire if no expiration date", async () => {
    const { redeemableFactory, loyaltyProgram, subscriptions } = await loadFixture(deployFixture);
    const loyaltyProgramAddress = await loyaltyProgram.getAddress();

    const startDate = Math.floor(Date.now() / 1000).toString();
    const endDate = 0; // no expiration date

    // Subscribe the owner to the basic plan
    await subscriptions.instance.subscribe(plan.basic, false, { value: pricePerPlan.basic });

    await redeemableFactory.instance.createNewPromotion(
      "ipfs://uri",
      startDate,
      endDate,
      loyaltyProgramAddress,
      promoType.freeProducts, // 1
    );

    // Get new promo instance
    const allPromos = await loyaltyProgram.getAllPromotions();
    expect(allPromos.length).to.equal(2);
    const redeemable = await ethers.getContractAt("Redeemable", allPromos[1].promotionAddress);
    const redeemableAddress = await redeemable.getAddress();

    expect(await redeemable.isActive()).to.equal(true);
    expect(await loyaltyProgram.getPromotionStatus(redeemableAddress)).to.equal(true);
    expect(await redeemable.isExpired()).to.equal(false);

    expect(await redeemable.isExpired()).to.equal(false); // still not expired
  });

  it("should activate/deactivate fine with collectible type", async () => {
    const { loyaltyProgram, collectiblesFactory, subscriptions, owner } =
      await loadFixture(deployFixture);
    const loyaltyProgramAddress = await loyaltyProgram.getAddress();

    // Subscribe the owner to the basic plan
    await subscriptions.instance.subscribe(plan.basic, false, { value: pricePerPlan.basic });

    // Create a new promo via the redeemable factory
    const startDate = Math.floor(Date.now() / 1000).toString();
    const endDate = 0; // no expiration date

    await expect(
      collectiblesFactory.instance.createNewPromotion(
        subscriptions_uris,
        startDate,
        endDate,
        loyaltyProgramAddress,
        promoType.freeProducts,
      ),
    ).to.be.revertedWithCustomError(
      collectiblesFactory.instance,
      "CollectiblesFactory__TypeNotSupported",
    );

    await collectiblesFactory.instance.createNewPromotion(
      subscriptions_uris,
      startDate,
      endDate,
      loyaltyProgramAddress,
      promoType.stamps,
    );

    // Check the new state  (2 promos: redeemables + collectibles)
    const allPromos = await loyaltyProgram.getAllPromotions();
    expect(allPromos.length).to.equal(2);

    const collectibles = await ethers.getContractAt("Collectibles", allPromos[1].promotionAddress);
    const collectiblesAddress = await collectibles.getAddress();

    // Check the current state  (1 promo)
    const newPromos = await loyaltyProgram.getAllPromotions();
    expect(newPromos[0].active).to.equal(true);
    expect(newPromos[1].active).to.equal(true);
    const activesBefore = await loyaltyProgram.getAllPromotionsPerStatus(true);
    expect(activesBefore.length).to.equal(2);
    const inactivesBefore = await loyaltyProgram.getAllPromotionsPerStatus(false);
    expect(inactivesBefore.length).to.equal(0);

    expect(await collectibles.isActive()).to.equal(true);

    // Desactivate promo then check the status again
    const receipt = await loyaltyProgram.deactivatePromotion(collectiblesAddress);
    await expect(receipt)
      .to.emit(collectibles, "Deactivated")
      .withArgs(owner.address, collectiblesAddress);

    expect(await collectibles.isActive()).to.equal(false); // deactivated

    const promoUpdated = await loyaltyProgram.getAllPromotions();
    expect(promoUpdated[1].active).to.equal(false);
    const activesAfter = await loyaltyProgram.getAllPromotionsPerStatus(true);
    expect(activesAfter.length).to.equal(1);
    const inactivesAfter = await loyaltyProgram.getAllPromotionsPerStatus(false);
    expect(inactivesAfter.length).to.equal(1);

    const receipt2 = await loyaltyProgram.activatePromotion(collectiblesAddress);
    await expect(receipt2)
      .to.emit(collectibles, "Activated")
      .withArgs(owner.address, collectiblesAddress);

    expect(await collectibles.isActive()).to.equal(true); // reactivated
  });

  it("should activate/deactivate fine with nonExpirable type", async () => {
    const { loyaltyProgram, nonExpirableFactory, subscriptions, owner } =
      await loadFixture(deployFixture);
    const loyaltyProgramAddress = await loyaltyProgram.getAddress();

    // Subscribe the owner to the basic plan
    await subscriptions.instance.subscribe(plan.basic, false, { value: pricePerPlan.basic });

    // Create a new promo via the redeemable factory
    const fakeData = 0;

    await nonExpirableFactory.instance.createNewPromotion(
      "NE_Test",
      "NET",
      "ipfs://uri",
      loyaltyProgramAddress,
      fakeData,
      promoType.badges,
    );

    // Check the new state  (2 promos)
    const allPromos = await loyaltyProgram.getAllPromotions();
    expect(allPromos.length).to.equal(2);

    const nonExpirable = await ethers.getContractAt("NonExpirable", allPromos[1].promotionAddress);
    const nonExpirableAddress = await nonExpirable.getAddress();

    // Check the current state  (1 promo)
    const newPromos = await loyaltyProgram.getAllPromotions();
    expect(newPromos[1].active).to.equal(true);
    const activesBefore = await loyaltyProgram.getAllPromotionsPerStatus(true);
    expect(activesBefore.length).to.equal(2);
    const inactivesBefore = await loyaltyProgram.getAllPromotionsPerStatus(false);
    expect(inactivesBefore.length).to.equal(0);

    expect(await nonExpirable.isActive()).to.equal(true);

    const receipt = await loyaltyProgram.deactivatePromotion(nonExpirableAddress);
    await expect(receipt)
      .to.emit(nonExpirable, "Deactivated")
      .withArgs(owner.address, nonExpirableAddress);

    expect(await nonExpirable.isActive()).to.equal(false); // deactivated

    const promoUpdated = await loyaltyProgram.getAllPromotions();
    expect(promoUpdated[1].active).to.equal(false);
    const activesAfter = await loyaltyProgram.getAllPromotionsPerStatus(true);
    expect(activesAfter.length).to.equal(1);
    const inactivesAfter = await loyaltyProgram.getAllPromotionsPerStatus(false);
    expect(inactivesAfter.length).to.equal(1);

    const receipt2 = await loyaltyProgram.activatePromotion(nonExpirableAddress);
    await expect(receipt2)
      .to.emit(nonExpirable, "Activated")
      .withArgs(owner.address, nonExpirableAddress);

    expect(await nonExpirable.isActive()).to.equal(true); // reactivated
  });
});
