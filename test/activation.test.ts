require("@nomicfoundation/hardhat-chai-matchers");
import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";

import { deploy } from "./helpers/deploy";
import { ethers } from "hardhat";
import { duration, plan, pricePerPlan, promoType, subscriptions_uris } from "./constant";

describe("Activation Feature", function () {
  async function deployFixture() {
    const {
      adminRegistry,
      subscriptions,
      meedProgramFactory,
      redeemableFactory,
      collectiblesFactory,
      nonExpirableFactory,
      meedProgram,
      expirationDate,
      owner,
      user1,
      user2,
      user3,
      admin,
    } = await deploy();

    // Create a new promo via the redeemable factory
    const startDate = Math.floor(Date.now() / 1000).toString();

    await redeemableFactory.createNewPromotion(
      "ipfs://uri",
      startDate,
      expirationDate,
      meedProgram.address,
      1
    );

    // Check the new state  (1 promo)
    const allPromos = await meedProgram.getAllPromotions();
    expect(allPromos.length).to.equal(1);

    const redeemable = await ethers.getContractAt("Redeemable", allPromos[0].promotionAddress);

    return {
      adminRegistry,
      subscriptions,
      meedProgramFactory,
      redeemableFactory,
      collectiblesFactory,
      nonExpirableFactory,
      meedProgram,
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
    const { meedProgram, redeemable, user1, admin } = await loadFixture(deployFixture);

    expect(await redeemable.isActive()).to.equal(true);

    // revert if not owner or admin
    await expect(
      meedProgram.connect(user1).deactivatePromotion(redeemable.address)
    ).to.be.revertedWithCustomError(meedProgram, "Adminable__NotAuthorized");

    // revert if admin but owner not subscriber
    await expect(
      meedProgram.connect(admin).deactivatePromotion(redeemable.address)
    ).to.be.revertedWithCustomError(meedProgram, "SubscriberChecks__PleaseSubscribeFirst");

    expect(await redeemable.isActive()).to.equal(true); // still true
  });

  it("should be possible to deactivate a promo if owner", async () => {
    const { meedProgram, redeemable, owner, user1 } = await loadFixture(deployFixture);

    // Check the current state  (1 promo)
    const newPromos = await meedProgram.getAllPromotions();
    expect(newPromos[0].active).to.equal(true);
    const activesBefore = await meedProgram.getAllPromotionsPerStatus(true);
    expect(activesBefore.length).to.equal(1);
    const inactivesBefore = await meedProgram.getAllPromotionsPerStatus(false);
    expect(inactivesBefore.length).to.equal(0);

    expect(await redeemable.isActive()).to.equal(true);

    const receipt = await meedProgram.deactivatePromotion(redeemable.address);
    await expect(receipt)
      .to.emit(redeemable, "Deactivated")
      .withArgs(owner.address, redeemable.address);

    expect(await redeemable.isActive()).to.equal(false); // deactivated

    const promoUpdated = await meedProgram.getAllPromotions();
    expect(promoUpdated[0].active).to.equal(false);
    const activesAfter = await meedProgram.getAllPromotionsPerStatus(true);
    expect(activesAfter.length).to.equal(0);
    const inactivesAfter = await meedProgram.getAllPromotionsPerStatus(false);
    expect(inactivesAfter.length).to.equal(1);

    // revert if not owner or admin
    await expect(
      meedProgram.connect(user1).activatePromotion(redeemable.address)
    ).to.be.revertedWithCustomError(meedProgram, "Adminable__NotAuthorized");

    const receipt2 = await meedProgram.activatePromotion(redeemable.address);
    await expect(receipt2)
      .to.emit(redeemable, "Activated")
      .withArgs(owner.address, redeemable.address);

    expect(await redeemable.isActive()).to.equal(true); // reactivated
  });

  it("should be possible to deactivate a promo if admin and owner subscribed", async () => {
    const { subscriptions, meedProgram, redeemable, admin } = await loadFixture(deployFixture);

    // Check the current state  (1 promo)
    const newPromos = await meedProgram.getAllPromotions();
    expect(newPromos[0].active).to.equal(true);
    const activesBefore = await meedProgram.getAllPromotionsPerStatus(true);
    expect(activesBefore.length).to.equal(1);
    const inactivesBefore = await meedProgram.getAllPromotionsPerStatus(false);
    expect(inactivesBefore.length).to.equal(0);

    expect(await redeemable.isActive()).to.equal(true);

    // revert if admin but owner not subscriber
    await expect(
      meedProgram.connect(admin).deactivatePromotion(redeemable.address)
    ).to.be.revertedWithCustomError(meedProgram, "SubscriberChecks__PleaseSubscribeFirst");

    // Owner subscribes and then deactivates via admin
    await subscriptions.subscribe(plan.basic, false, { value: pricePerPlan.basic });

    const receipt = await meedProgram.connect(admin).deactivatePromotion(redeemable.address);
    await expect(receipt)
      .to.emit(redeemable, "Deactivated")
      .withArgs(admin.address, redeemable.address);

    expect(await redeemable.isActive()).to.equal(false); // deactivated

    const promoUpdated = await meedProgram.getAllPromotions();
    expect(promoUpdated[0].active).to.equal(false);
    const activesAfter = await meedProgram.getAllPromotionsPerStatus(true);
    expect(activesAfter.length).to.equal(0);
    const inactivesAfter = await meedProgram.getAllPromotionsPerStatus(false);
    expect(inactivesAfter.length).to.equal(1);

    const receipt2 = await meedProgram.connect(admin).activatePromotion(redeemable.address);
    await expect(receipt2)
      .to.emit(redeemable, "Activated")
      .withArgs(admin.address, redeemable.address);

    expect(await redeemable.isActive()).to.equal(true); // reactivated
  });

  it("shouldn't be possible to deactivate a promo if already deactivate", async () => {
    const { meedProgram, redeemable, owner } = await loadFixture(deployFixture);

    expect(await redeemable.isActive()).to.equal(true);

    // revert because already activated
    await expect(meedProgram.activatePromotion(redeemable.address)).to.be.revertedWithCustomError(
      redeemable,
      "Activation__PromotionCurrentlyActive"
    );

    const receipt = await meedProgram.deactivatePromotion(redeemable.address);
    await expect(receipt)
      .to.emit(redeemable, "Deactivated")
      .withArgs(owner.address, redeemable.address);

    expect(await redeemable.isActive()).to.equal(false); // deactivated

    // revert because already deactivated
    await expect(meedProgram.deactivatePromotion(redeemable.address)).to.be.revertedWithCustomError(
      redeemable,
      "Activation__PromotionCurrentlyInactive"
    );
  });

  it("shouldn't be possible to update the expiration date if inactive", async () => {
    const { meedProgram, redeemable, owner } = await loadFixture(deployFixture);

    // deactivate promo
    const receipt = await meedProgram.deactivatePromotion(redeemable.address);
    await expect(receipt)
      .to.emit(redeemable, "Deactivated")
      .withArgs(owner.address, redeemable.address);

    expect(await redeemable.isActive()).to.equal(false); // deactivated
    expect(await meedProgram.getPromotionStatus(redeemable.address)).to.equal(false);

    // Update expiration date (revert if inactive):
    const newExpirationDate = (Math.floor(Date.now() / 1000) + duration.year * 3).toString();
    await expect(redeemable.updateExpirationDate(newExpirationDate)).to.be.revertedWithCustomError(
      redeemable,
      "Activation__PromotionCurrentlyInactive"
    );
  });

  it("shouldn't expire if no expiration date", async () => {
    const { redeemableFactory, meedProgram } = await loadFixture(deployFixture);

    const startDate = Math.floor(Date.now() / 1000).toString();

    await redeemableFactory.createNewPromotion(
      "ipfs://uri",
      startDate,
      0, // no expiration date
      meedProgram.address,
      1
    );

    // Get new promo instance
    const allPromos = await meedProgram.getAllPromotions();
    expect(allPromos.length).to.equal(2);
    const redeemable = await ethers.getContractAt("Redeemable", allPromos[1].promotionAddress);

    expect(await redeemable.isActive()).to.equal(true);
    expect(await meedProgram.getPromotionStatus(redeemable.address)).to.equal(true);
    expect(await redeemable.isExpired()).to.equal(false);

    expect(await redeemable.isExpired()).to.equal(false); // still not expired
  });

  it("should activate/deactivate fine with collectible type", async () => {
    const { meedProgram, collectiblesFactory, owner } = await loadFixture(deployFixture);

    // Create a new promo via the redeemable factory
    const startDate = Math.floor(Date.now() / 1000).toString();

    await expect(
      collectiblesFactory.createNewPromotion(
        subscriptions_uris,
        startDate,
        0,
        meedProgram.address,
        promoType.freeProducts
      )
    ).to.be.revertedWithCustomError(collectiblesFactory, "CollectiblesFactory_TypeNotSupported");

    await collectiblesFactory.createNewPromotion(
      subscriptions_uris,
      startDate,
      0,
      meedProgram.address,
      promoType.stamps
    );

    // Check the new state  (2 promos: redeemables + collectibles)
    const allPromos = await meedProgram.getAllPromotions();
    expect(allPromos.length).to.equal(2);

    const collectibles = await ethers.getContractAt("Collectibles", allPromos[1].promotionAddress);

    // Check the current state  (1 promo)
    const newPromos = await meedProgram.getAllPromotions();
    expect(newPromos[0].active).to.equal(true);
    expect(newPromos[1].active).to.equal(true);
    const activesBefore = await meedProgram.getAllPromotionsPerStatus(true);
    expect(activesBefore.length).to.equal(2);
    const inactivesBefore = await meedProgram.getAllPromotionsPerStatus(false);
    expect(inactivesBefore.length).to.equal(0);

    expect(await collectibles.isActive()).to.equal(true);

    // Desactivate promo then check the status again
    const receipt = await meedProgram.deactivatePromotion(collectibles.address);
    await expect(receipt)
      .to.emit(collectibles, "Deactivated")
      .withArgs(owner.address, collectibles.address);

    expect(await collectibles.isActive()).to.equal(false); // deactivated

    const promoUpdated = await meedProgram.getAllPromotions();
    expect(promoUpdated[1].active).to.equal(false);
    const activesAfter = await meedProgram.getAllPromotionsPerStatus(true);
    expect(activesAfter.length).to.equal(1);
    const inactivesAfter = await meedProgram.getAllPromotionsPerStatus(false);
    expect(inactivesAfter.length).to.equal(1);

    const receipt2 = await meedProgram.activatePromotion(collectibles.address);
    await expect(receipt2)
      .to.emit(collectibles, "Activated")
      .withArgs(owner.address, collectibles.address);

    expect(await collectibles.isActive()).to.equal(true); // reactivated
  });

  it("should activate/deactivate fine with nonExpirable type", async () => {
    const { meedProgram, nonExpirableFactory, owner } = await loadFixture(deployFixture);

    // Create a new promo via the redeemable factory
    const fakeData = 0;

    await nonExpirableFactory.createNewPromotion(
      "NE_Test",
      "NET",
      "ipfs://uri",
      meedProgram.address,
      fakeData,
      promoType.badges
    );

    // Check the new state  (2 promos)
    const allPromos = await meedProgram.getAllPromotions();
    expect(allPromos.length).to.equal(2);

    const nonExpirable = await ethers.getContractAt("NonExpirable", allPromos[1].promotionAddress);

    // Check the current state  (1 promo)
    const newPromos = await meedProgram.getAllPromotions();
    expect(newPromos[1].active).to.equal(true);
    const activesBefore = await meedProgram.getAllPromotionsPerStatus(true);
    expect(activesBefore.length).to.equal(2);
    const inactivesBefore = await meedProgram.getAllPromotionsPerStatus(false);
    expect(inactivesBefore.length).to.equal(0);

    expect(await nonExpirable.isActive()).to.equal(true);

    const receipt = await meedProgram.deactivatePromotion(nonExpirable.address);
    await expect(receipt)
      .to.emit(nonExpirable, "Deactivated")
      .withArgs(owner.address, nonExpirable.address);

    expect(await nonExpirable.isActive()).to.equal(false); // deactivated

    const promoUpdated = await meedProgram.getAllPromotions();
    expect(promoUpdated[1].active).to.equal(false);
    const activesAfter = await meedProgram.getAllPromotionsPerStatus(true);
    expect(activesAfter.length).to.equal(1);
    const inactivesAfter = await meedProgram.getAllPromotionsPerStatus(false);
    expect(inactivesAfter.length).to.equal(1);

    const receipt2 = await meedProgram.activatePromotion(nonExpirable.address);
    await expect(receipt2)
      .to.emit(nonExpirable, "Activated")
      .withArgs(owner.address, nonExpirable.address);

    expect(await nonExpirable.isActive()).to.equal(true); // reactivated
  });
});
