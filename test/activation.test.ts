require("@nomicfoundation/hardhat-chai-matchers");
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";

import { deploy } from "./helpers/deploy";
import { ethers } from "hardhat";
import { plan, pricePerPlan } from "./constant";

describe("Activation Feature", function () {
  async function deployFixture() {
    const {
      adminRegistry,
      subscriptions,
      meedProgramFactory,
      redeemableFactory,
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
    const { meedProgram, redeemable, owner } = await loadFixture(deployFixture);

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
});
