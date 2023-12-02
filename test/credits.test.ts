require("@nomicfoundation/hardhat-chai-matchers");
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";

import { deploy } from "./helpers/deploy";
import { ethers } from "hardhat";
import {
  creditsPerPlan,
  plan,
  planDuration,
  pricePerPlan,
  promoType,
  topUpFormula,
  voucher_type,
} from "./helpers/constant";

const type = voucher_type.percentDiscount;
const value = [10, 20, 30];

describe("Credits Feature", function () {
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

    const Credits = await ethers.getContractFactory("Credits");
    const credits = await Credits.deploy(adminRegistry.address, owner.address);
    await credits.waitForDeployment();

    // Create a new promo via the redeemable factory
    const startDate = Math.floor(Date.now() / 1000).toString();
    const loyaltyProgramAddress = loyaltyProgram.getAddress();

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
      loyaltyProgramAddress,
      redeemable,
      credits,
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

    const credit_0 = await subscriptions.instance.creditPlans(0);
    expect(credit_0.credits).to.equal(500);
    expect(credit_0.price).to.equal(ethers.parseEther("0.02"));

    const credit_1 = await subscriptions.instance.creditPlans(1);
    expect(credit_1.credits).to.equal(5000);
    expect(credit_1.price).to.equal(ethers.parseEther("0.15"));

    const credit_2 = await subscriptions.instance.creditPlans(2);
    expect(credit_2.credits).to.equal(25_000);
    expect(credit_2.price).to.equal(ethers.parseEther("0.5"));

    const credit_3 = await subscriptions.instance.creditPlans(3);
    expect(credit_3.credits).to.equal(100_000);
    expect(credit_3.price).to.equal(ethers.parseEther("1.5"));
  });

  /*///////////////////////////////////////////////////////////////////////////////
                                   ADD CREDITS
    ///////////////////////////////////////////////////////////////////////////////*/

  it("should add credit when subscribing", async () => {
    const { subscriptions, user1, user2, user3 } = await loadFixture(deployFixture);

    // Monthly subscription BASIC
    await subscriptions.instance
      .connect(user1)
      .subscribe(plan.basic, planDuration.monthly, { value: pricePerPlan.basic });

    expect(await subscriptions.instance.getUserCredits(user1.address)).to.equal(
      creditsPerPlan.basic,
    );

    // Yearly subscription PRO
    await subscriptions.instance
      .connect(user2)
      .subscribe(plan.pro, planDuration.yearly, { value: pricePerPlan.pro * 10n });

    expect(await subscriptions.instance.getUserCredits(user2.address)).to.equal(
      creditsPerPlan.pro * 12,
    );

    // Monthly subscription ENTERPRISE
    await subscriptions.instance
      .connect(user3)
      .subscribe(plan.enterprise, planDuration.monthly, { value: pricePerPlan.enterprise });

    expect(await subscriptions.instance.getUserCredits(user3.address)).to.equal(
      creditsPerPlan.enterprise,
    );
  });

  it("should add credit when renewing subscription", async () => {
    const { subscriptions, user1 } = await loadFixture(deployFixture);

    const tokenId = 1;

    // Monthly subscription PRO
    await subscriptions.instance
      .connect(user1)
      .subscribe(plan.pro, planDuration.monthly, { value: pricePerPlan.pro });

    expect(await subscriptions.instance.getUserCredits(user1.address)).to.equal(creditsPerPlan.pro);

    await subscriptions.instance
      .connect(user1)
      .renewSubscription(tokenId, plan.pro, planDuration.yearly, {
        value: pricePerPlan.pro * 10n,
      });

    expect(await subscriptions.instance.getUserCredits(user1.address)).to.equal(
      creditsPerPlan.pro + creditsPerPlan.pro * 12,
    );
  });

  it("should be possible to top up credits", async () => {
    const { subscriptions, user1 } = await loadFixture(deployFixture);

    // Monthly subscription BASIC = 2500 credits
    await subscriptions.instance
      .connect(user1)
      .subscribe(plan.basic, planDuration.monthly, { value: pricePerPlan.basic });

    expect(await subscriptions.instance.getUserCredits(user1.address)).to.equal(
      creditsPerPlan.basic,
    );

    await subscriptions.instance
      .connect(user1)
      .buyCredits(topUpFormula.small.id, { value: topUpFormula.small.price });

    expect(await subscriptions.instance.getUserCredits(user1.address)).to.equal(
      creditsPerPlan.basic + topUpFormula.small.credits,
    );
  });

  it("shouldn't be possible to top up credits in the following cases", async () => {
    const { subscriptions, user1 } = await loadFixture(deployFixture);

    // Not subscriber or Free plan:
    await expect(
      subscriptions.instance
        .connect(user1)
        .buyCredits(topUpFormula.small.id, { value: topUpFormula.small.price }),
    ).to.be.revertedWithCustomError(subscriptions.instance, "Subscriptions__SubscriptionExpired");

    await subscriptions.instance
      .connect(user1)
      .subscribe(plan.basic, planDuration.monthly, { value: pricePerPlan.basic });

    // Insufficient price
    await expect(
      subscriptions.instance
        .connect(user1)
        .buyCredits(topUpFormula.big.id, { value: topUpFormula.small.price }),
    ).to.be.revertedWithCustomError(subscriptions.instance, "Credits__InsufficientFunds");
  });

  it("should refund the different if too much ETH is paid during topup", async () => {
    const { subscriptions, user1 } = await loadFixture(deployFixture);

    await subscriptions.instance
      .connect(user1)
      .subscribe(plan.basic, planDuration.monthly, { value: pricePerPlan.basic });

    const balance_before = await ethers.provider.getBalance(user1.address);

    await subscriptions.instance
      .connect(user1)
      .buyCredits(topUpFormula.small.id, { value: topUpFormula.huge.price });

    const balance_after = await ethers.provider.getBalance(user1.address);

    // Let some margin for gas fees:
    expect(Number(balance_after) / 10 ** 18).to.be.approximately(
      Number(balance_before) / 10 ** 18 - 0.02,
      0.01,
    );
  });

  it("should be possible to withdraw after top up", async () => {
    const { subscriptions, owner, user1 } = await loadFixture(deployFixture);

    // Monthly subscription BASIC = 2500 credits
    await subscriptions.instance
      .connect(user1)
      .subscribe(plan.basic, planDuration.monthly, { value: pricePerPlan.basic });

    expect(await subscriptions.instance.getUserCredits(user1.address)).to.equal(
      creditsPerPlan.basic,
    );

    await subscriptions.instance
      .connect(user1)
      .buyCredits(topUpFormula.big.id, { value: topUpFormula.big.price });

    expect(await subscriptions.instance.getUserCredits(user1.address)).to.equal(
      creditsPerPlan.basic + topUpFormula.big.credits,
    );

    const balance_before = await ethers.provider.getBalance(owner.address);

    await subscriptions.instance.connect(owner).withdraw();

    // Expect balance + 0.5 ETH from top up + 0.05 ETH from basic subscription
    const balance_after = await ethers.provider.getBalance(owner.address);
    expect(Number(balance_after) / 10 ** 18).to.be.approximately(
      Number(balance_before) / 10 ** 18 + 0.5 + Number(pricePerPlan.basic) / 10 ** 18,
      0.01,
    );
  });

  /*///////////////////////////////////////////////////////////////////////////////
                                   REMOVE CREDITS
    ///////////////////////////////////////////////////////////////////////////////*/

  it("should remove credits each time the admin is used", async () => {
    const { subscriptions, loyaltyProgram, redeemable, owner, admin, user1 } =
      await loadFixture(deployFixture);

    // Monthly subscription BASIC - 2500 credits
    await subscriptions.instance.subscribe(plan.basic, planDuration.monthly, {
      value: pricePerPlan.basic,
    });

    const intialCredits = await subscriptions.instance.getUserCredits(owner.address);
    expect(intialCredits).to.equal(creditsPerPlan.basic);

    await redeemable.connect(admin).addNewRedeemableNFT(type, value[0]);

    expect(await subscriptions.instance.getUserCredits(owner.address)).to.equal(
      creditsPerPlan.basic - 1,
    );

    // Add user to the Loyalty program
    await loyaltyProgram.mint(user1.address);

    const tokenId = 0;
    await redeemable.connect(admin).mint(tokenId, user1.address);
    expect(await subscriptions.instance.getUserCredits(owner.address)).to.equal(
      Number(intialCredits) - 2,
    );

    await redeemable.connect(admin).redeem(user1.address, tokenId);
    expect(await subscriptions.instance.getUserCredits(owner.address)).to.equal(
      Number(intialCredits) - 3,
    );
  });

  /*///////////////////////////////////////////////////////////////////////////////
                                   CREDITS CHECKS & CONTROL
    ///////////////////////////////////////////////////////////////////////////////*/

  it("shouldn't be possible to use admin when credits is exhausted", async () => {
    const { loyaltyProgram, redeemable, subscriptions, admin, owner, user1 } =
      await loadFixture(deployFixture);

    // Monthly subscription BASIC
    await subscriptions.instance.subscribe(plan.basic, planDuration.monthly, {
      value: pricePerPlan.basic,
    });

    const receipt = await subscriptions.instance.deductCredits(owner.address, 2499);
    await expect(receipt)
      .to.emit(subscriptions.instance, "CreditsDeducted")
      .withArgs(owner.address, 2499);

    // Should have only 1 credit left:
    expect(await subscriptions.instance.getUserCredits(owner.address)).to.equal(1);

    // Add user to the Loyalty program
    await loyaltyProgram.connect(admin).mint(user1.address);

    // Should have 0 credit left:
    expect(await subscriptions.instance.getUserCredits(user1.address)).to.equal(0);

    const tokenId_0 = 0;
    await expect(
      redeemable.connect(admin).mint(tokenId_0, user1.address),
    ).to.be.revertedWithCustomError(subscriptions.instance, "Credits__InsufficientCredits");

    // should revert if deduct credits again:
    await expect(
      subscriptions.instance.deductCredits(owner.address, 10),
    ).to.be.revertedWithCustomError(subscriptions.instance, "Credits__InsufficientCredits");
  });

  it("shouldn't be possible to use restricted functions if unauthorized", async () => {
    const { subscriptions, user1, user2 } = await loadFixture(deployFixture);

    // Monthly subscription BASIC
    await subscriptions.instance
      .connect(user1)
      .subscribe(plan.basic, planDuration.monthly, { value: pricePerPlan.basic });

    await expect(
      subscriptions.instance.connect(user2).setUserCredits(user1.address, 1000),
    ).to.be.revertedWithCustomError(subscriptions.instance, "OwnableUnauthorizedAccount");

    await expect(
      subscriptions.instance.connect(user2).deductCredits(user1.address, 1000),
    ).to.be.revertedWithCustomError(subscriptions.instance, "OwnableUnauthorizedAccount");

    await expect(
      subscriptions.instance
        .connect(user2)
        .setCreditPlan(topUpFormula.small.id, 4000, ethers.parseEther("0.1")),
    ).to.be.revertedWithCustomError(subscriptions.instance, "OwnableUnauthorizedAccount");
  });

  it("should be possible to manually set credits for user", async () => {
    const { subscriptions, user1 } = await loadFixture(deployFixture);

    // Monthly subscription BASIC
    await subscriptions.instance
      .connect(user1)
      .subscribe(plan.basic, planDuration.monthly, { value: pricePerPlan.basic });

    // Should have 2500 credit from subscription:
    expect(await subscriptions.instance.getUserCredits(user1.address)).to.equal(2500);

    const receipt = await subscriptions.instance.setUserCredits(user1.address, 1000);
    await expect(receipt)
      .to.emit(subscriptions.instance, "CreditsAdded")
      .withArgs(user1.address, 1000);

    // Should now have 3500 credit with manual addition:
    expect(await subscriptions.instance.getUserCredits(user1.address)).to.equal(3500);
  });

  it("should be possible to edit the topup price and credits", async () => {
    const { subscriptions, user1 } = await loadFixture(deployFixture);

    // Monthly subscription BASIC
    await subscriptions.instance
      .connect(user1)
      .subscribe(plan.basic, planDuration.monthly, { value: pricePerPlan.basic });

    await subscriptions.instance
      .connect(user1)
      .buyCredits(topUpFormula.small.id, { value: topUpFormula.small.price });

    // Initial top up amount added (2500 + 500)
    expect(await subscriptions.instance.getUserCredits(user1.address)).to.equal(
      creditsPerPlan.basic + topUpFormula.small.credits,
    );

    //Edit the topup price and credits:
    await subscriptions.instance.setCreditPlan(
      topUpFormula.small.id,
      1000,
      ethers.parseEther("0.1"),
    );

    // Top up again with new price:
    await expect(
      subscriptions.instance
        .connect(user1)
        .buyCredits(topUpFormula.small.id, { value: topUpFormula.small.price }),
    ).to.be.revertedWithCustomError(subscriptions.instance, "Credits__InsufficientFunds");

    const receipt = await subscriptions.instance
      .connect(user1)
      .buyCredits(topUpFormula.small.id, { value: ethers.parseEther("0.1") });
    expect(receipt).to.emit(subscriptions.instance, "CreditsAdded").withArgs(user1.address, 1000);

    // Should now have 4000 credits with manual addition:
    expect(await subscriptions.instance.getUserCredits(user1.address)).to.equal(4000);
  });

  /*///////////////////////////////////////////////////////////////////////////////
                            OVERRIDED FUNCTIONS FOR COVERAGE
    ///////////////////////////////////////////////////////////////////////////////*/

  it("should be possible to buy credits, then withdraw credits", async () => {
    const { credits, owner, user1 } = await loadFixture(deployFixture);

    // Should have 0 credit at start:
    expect(await credits.connect(user1).getUserCredits(user1.address)).to.equal(0);

    // buy credits:
    const receipt = await credits
      .connect(user1)
      .buyCredits(topUpFormula.small.id, { value: topUpFormula.small.price });

    await expect(receipt)
      .to.emit(credits, "CreditsAdded")
      .withArgs(user1.address, topUpFormula.small.credits);

    // Should now have 500 credits:
    expect(await credits.connect(user1).getUserCredits(user1.address)).to.equal(500);

    const balance_before = await ethers.provider.getBalance(owner.address);

    await credits.withdraw();

    // Expect balance + 0.02 ETH from top up
    const balance_after = await ethers.provider.getBalance(owner.address);
    expect(Number(balance_after) / 10 ** 18).to.be.approximately(
      Number(balance_before) / 10 ** 18 + 0.02,
      0.005,
    );
  });
});
