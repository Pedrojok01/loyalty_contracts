require("@nomicfoundation/hardhat-chai-matchers");
import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";

import { deploy } from "./helpers/deploy";
import { ethers } from "hardhat";
import {
  creditsPerPlan,
  duration,
  plan,
  planDuration,
  pricePerPlan,
  promoType,
  subscriptions_uris,
  topUpFormula,
  voucher_type,
} from "./constant";
import { parseEther } from "ethers/lib/utils";

const type = voucher_type.percentDiscount;
const value = [10, 20, 30];
const amountRequired = 100;

describe("Credits Feature", function () {
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

  it("should be deployed with correct values", async () => {
    const { subscriptions } = await loadFixture(deployFixture);

    const credit_0 = await subscriptions.creditPlans(0);
    expect(credit_0.credits).to.equal(500);
    expect(credit_0.price).to.equal(parseEther("0.02"));

    const credit_1 = await subscriptions.creditPlans(1);
    expect(credit_1.credits).to.equal(5000);
    expect(credit_1.price).to.equal(parseEther("0.15"));

    const credit_2 = await subscriptions.creditPlans(2);
    expect(credit_2.credits).to.equal(25_000);
    expect(credit_2.price).to.equal(parseEther("0.5"));

    const credit_3 = await subscriptions.creditPlans(3);
    expect(credit_3.credits).to.equal(100_000);
    expect(credit_3.price).to.equal(parseEther("1.5"));
  });

  /*///////////////////////////////////////////////////////////////////////////////
                                   ADD CREDITS
    ///////////////////////////////////////////////////////////////////////////////*/

  it("should add credit when subscribing", async () => {
    const { subscriptions, user1, user2, user3 } = await loadFixture(deployFixture);

    // Monthly subscription BASIC
    await subscriptions
      .connect(user1)
      .subscribe(plan.basic, planDuration.monthly, { value: pricePerPlan.basic });

    expect(await subscriptions.getUserCredits(user1.address)).to.equal(creditsPerPlan.basic);

    // Yearly subscription PRO
    await subscriptions
      .connect(user2)
      .subscribe(plan.pro, planDuration.yearly, { value: pricePerPlan.pro.mul(10) });

    expect(await subscriptions.getUserCredits(user2.address)).to.equal(creditsPerPlan.pro * 12);

    // Monthly subscription ENTERPRISE
    await subscriptions
      .connect(user3)
      .subscribe(plan.enterprise, planDuration.monthly, { value: pricePerPlan.enterprise });

    expect(await subscriptions.getUserCredits(user3.address)).to.equal(creditsPerPlan.enterprise);
  });

  it("should add credit when renewing subscription", async () => {
    const { subscriptions, user1 } = await loadFixture(deployFixture);

    const tokenId = 1;

    // Monthly subscription PRO
    await subscriptions
      .connect(user1)
      .subscribe(plan.pro, planDuration.monthly, { value: pricePerPlan.pro });

    expect(await subscriptions.getUserCredits(user1.address)).to.equal(creditsPerPlan.pro);

    await subscriptions.connect(user1).renewSubscription(tokenId, plan.pro, planDuration.yearly, {
      value: pricePerPlan.pro.mul(10),
    });

    expect(await subscriptions.getUserCredits(user1.address)).to.equal(
      creditsPerPlan.pro + creditsPerPlan.pro * 12
    );
  });

  it("should be possible to top up credits", async () => {
    const { subscriptions, user1 } = await loadFixture(deployFixture);

    // Monthly subscription BASIC = 2500 credits
    await subscriptions
      .connect(user1)
      .subscribe(plan.basic, planDuration.monthly, { value: pricePerPlan.basic });

    expect(await subscriptions.getUserCredits(user1.address)).to.equal(creditsPerPlan.basic);

    await subscriptions
      .connect(user1)
      .buyCredits(topUpFormula.small.id, { value: parseEther("0.05") });

    expect(await subscriptions.getUserCredits(user1.address)).to.equal(
      creditsPerPlan.basic + topUpFormula.small.value
    );
  });

  it("shouldn't be possible to top up credits in the following cases", async () => {
    const { subscriptions, user1 } = await loadFixture(deployFixture);

    // Not subscriber or Free plan:
    await expect(
      subscriptions.connect(user1).buyCredits(topUpFormula.small.id, { value: parseEther("0.05") })
    ).to.be.revertedWithCustomError(subscriptions, "Subscriptions__SubscriptionExpired");

    await subscriptions
      .connect(user1)
      .subscribe(plan.basic, planDuration.monthly, { value: pricePerPlan.basic });

    // Insufficient price
    await expect(
      subscriptions.connect(user1).buyCredits(topUpFormula.big.id, { value: parseEther("0.05") })
    ).to.be.revertedWithCustomError(subscriptions, "Credits__InsufficientFunds");
  });

  it("should refund the different if too much ETH is paid during topup", async () => {
    const { subscriptions, user1 } = await loadFixture(deployFixture);

    await subscriptions
      .connect(user1)
      .subscribe(plan.basic, planDuration.monthly, { value: pricePerPlan.basic });

    const balance_before = await user1.getBalance();

    await subscriptions
      .connect(user1)
      .buyCredits(topUpFormula.small.id, { value: parseEther("1") });

    const balance_after = await user1.getBalance();

    // Let some margin for gas fees:
    expect(Number(balance_after) / 10 ** 18).to.be.approximately(
      Number(balance_before) / 10 ** 18 - 0.05,
      0.1
    );
  });

  /*///////////////////////////////////////////////////////////////////////////////
                                   REMOVE CREDITS
    ///////////////////////////////////////////////////////////////////////////////*/

  it("should remove credits each time the admin is used", async () => {
    const { subscriptions, meedProgram, redeemable, owner, admin, user1 } = await loadFixture(
      deployFixture
    );

    // Monthly subscription BASIC - 2500 credits
    await subscriptions.subscribe(plan.basic, planDuration.monthly, { value: pricePerPlan.basic });

    const intialCredits = await subscriptions.getUserCredits(owner.address);
    expect(intialCredits).to.equal(creditsPerPlan.basic);

    await redeemable.connect(admin).addNewRedeemableNFT(type, value[0], amountRequired);

    expect(await subscriptions.getUserCredits(owner.address)).to.equal(creditsPerPlan.basic - 1);

    // Add user to the Meed program
    await meedProgram.mint(user1.address);

    const tokenId = 0;
    await redeemable.connect(admin).mint(tokenId, user1.address);
    expect(await subscriptions.getUserCredits(owner.address)).to.equal(Number(intialCredits) - 2);

    await redeemable.connect(admin).redeem(user1.address, tokenId);
    expect(await subscriptions.getUserCredits(owner.address)).to.equal(Number(intialCredits) - 3);
  });

  /*///////////////////////////////////////////////////////////////////////////////
                                   CREDITS CHECKS & CONTROL
    ///////////////////////////////////////////////////////////////////////////////*/
});
