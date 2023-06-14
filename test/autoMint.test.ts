require("@nomicfoundation/hardhat-chai-matchers");
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";

import { deploy } from "./helpers/deploy";
import { ethers } from "hardhat";
import { auto_rewards, plan, pricePerPlan, voucher_type } from "./constant";
import { utils } from "ethers";

const type = voucher_type.percentDiscount;
const value = [10, 15, 20, 25, 30]; // vouchers value in percent
const levelRequired = [1, 2, 3, 4, 5]; // Bronze, Silver, Gold, Diamond, Platinum
const amountRequired = [100, 200, 300, 400, 500]; // purchased amount required
const tokenId = [0, 1, 2, 3, 4];
const amounts = [50, 145, 220, 367, 455, 999]; // Fake purchase amounts

describe("Auto Mint Feature", function () {
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
    await redeemable.addNewRedeemableNFT(type, value[0], amountRequired[0]);
    await redeemable.addNewRedeemableNFT(type, value[1], amountRequired[1]);
    await redeemable.addNewRedeemableNFT(type, value[2], amountRequired[2]);
    await redeemable.addNewRedeemableNFT(type, value[3], amountRequired[3]);
    await redeemable.addNewRedeemableNFT(type, value[4], amountRequired[4]);

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

  it("should initialise all contracts correctly", async () => {
    const { meedProgramFactory, redeemableFactory, redeemable, owner } = await loadFixture(
      deployFixture
    );

    expect(await meedProgramFactory.factories(0)).to.equal(redeemableFactory.address);
    expect(await redeemable.owner()).to.equal(owner.address);
  });

  /*///////////////////////////////////////////////////////////////////////////////
                                REDEEMABLE AUTO MINT
  ///////////////////////////////////////////////////////////////////////////////*/

  it("should be possible to add new autoReward", async () => {
    const { subscriptions, meedProgram, redeemable, admin, user1 } = await loadFixture(
      deployFixture
    );

    auto_rewards[0].promotion = redeemable.address;
    auto_rewards[1].promotion = redeemable.address;
    auto_rewards[2].promotion = redeemable.address;

    const receipt = await meedProgram.addAutoMintReward(
      auto_rewards[0].levelRequired,
      auto_rewards[0].promotion,
      auto_rewards[0].tokenId,
      auto_rewards[0].amountRequired
    );

    await expect(receipt)
      .to.emit(meedProgram, "AutoRewardAdded")
      .withArgs(
        auto_rewards[0].levelRequired,
        auto_rewards[0].promotion,
        auto_rewards[0].tokenId,
        auto_rewards[0].amountRequired
      );

    // Add a new autoReward with the admin account => revert
    await expect(
      meedProgram
        .connect(admin)
        .addAutoMintReward(
          auto_rewards[2].levelRequired,
          auto_rewards[2].promotion,
          auto_rewards[2].tokenId,
          auto_rewards[2].amountRequired
        )
    ).to.be.revertedWithCustomError(meedProgram, "SubscriberChecks__PleaseSubscribeFirst");

    // Add a new autoReward with the admin account => revert if wrong level passed
    const zeroLevel = 0;
    await expect(
      meedProgram.addAutoMintReward(
        zeroLevel,
        auto_rewards[2].promotion,
        auto_rewards[2].tokenId,
        auto_rewards[2].amountRequired
      )
    ).to.be.revertedWithCustomError(redeemable, "MeedProgram__LevelOutOfRange");

    const outOfRangeLevel = 8;
    await expect(
      meedProgram.addAutoMintReward(
        outOfRangeLevel,
        auto_rewards[2].promotion,
        auto_rewards[2].tokenId,
        auto_rewards[2].amountRequired
      )
    ).to.be.revertedWithCustomError(redeemable, "MeedProgram__LevelOutOfRange");

    // Subscribe the owner to the basic plan
    await subscriptions.subscribe(plan.basic, false, { value: pricePerPlan.basic });

    // Try the admin account again => Pass
    const receipt2 = await meedProgram
      .connect(admin)
      .addAutoMintReward(
        auto_rewards[1].levelRequired,
        auto_rewards[1].promotion,
        auto_rewards[1].tokenId,
        auto_rewards[1].amountRequired
      );

    await expect(receipt2)
      .to.emit(meedProgram, "AutoRewardAdded")
      .withArgs(
        auto_rewards[1].levelRequired,
        auto_rewards[1].promotion,
        auto_rewards[1].tokenId,
        auto_rewards[1].amountRequired
      );

    await expect(
      meedProgram
        .connect(user1)
        .addAutoMintReward(
          auto_rewards[2].levelRequired,
          auto_rewards[2].promotion,
          auto_rewards[2].tokenId,
          auto_rewards[2].amountRequired
        )
    ).to.be.revertedWithCustomError(meedProgram, "Adminable__NotAuthorized");
  });

  it("should correctly handle adding and removing auto rewards", async () => {
    const { meedProgram, redeemable } = await loadFixture(deployFixture);

    // Add auto reward
    auto_rewards[0].promotion = redeemable.address;
    await meedProgram.addAutoMintReward(
      auto_rewards[0].levelRequired,
      auto_rewards[0].promotion,
      auto_rewards[0].tokenId,
      auto_rewards[0].amountRequired
    );

    // !!! level start at 1 !!! 0 is for non-existing members
    let autoReward = await meedProgram.autoRewards(1);
    expect(autoReward.promotion).to.equal(auto_rewards[0].promotion);
    expect(autoReward.tokenId).to.equal(auto_rewards[0].tokenId);
    expect(autoReward.levelRequired).to.equal(auto_rewards[0].levelRequired);
    expect(autoReward.amountRequired).to.equal(auto_rewards[0].amountRequired);

    // Remove auto reward
    await meedProgram.removeAutoMintReward(1);

    autoReward = await meedProgram.autoRewards(1);
    expect(autoReward.promotion).to.equal(ethers.constants.AddressZero);
    expect(autoReward.tokenId).to.equal(0);
    expect(autoReward.levelRequired).to.equal(0);
    expect(autoReward.amountRequired).to.equal(0);
  });

  it("should revert if autoMint not called by contract", async () => {
    const { redeemable, user1 } = await loadFixture(deployFixture);

    await expect(redeemable.autoMint(tokenId[0], user1.address)).to.be.revertedWithCustomError(
      redeemable,
      "Redeemable__NotCalledFromContract"
    );
  });

  it("should not be possible to switch autoMint feature if not authorized", async () => {
    const { meedProgram, redeemable, user1, admin } = await loadFixture(deployFixture);

    await expect(meedProgram.connect(user1).switchAutoMintStatus()).to.be.revertedWithCustomError(
      redeemable,
      "Adminable__NotAuthorized"
    );
  });

  it("should not be possible to remove autoMint rewards if not authorized/wrong level", async () => {
    const { meedProgram, redeemable, user1 } = await loadFixture(deployFixture);

    await expect(meedProgram.connect(user1).removeAutoMintReward(1)).to.be.revertedWithCustomError(
      redeemable,
      "Adminable__NotAuthorized"
    );

    const zeroLevel = 0;
    await expect(meedProgram.removeAutoMintReward(zeroLevel)).to.be.revertedWithCustomError(
      redeemable,
      "MeedProgram__LevelOutOfRange"
    );

    const outOfRangeLevel = 8;
    await expect(meedProgram.removeAutoMintReward(outOfRangeLevel)).to.be.revertedWithCustomError(
      redeemable,
      "MeedProgram__LevelOutOfRange"
    );
  });

  it("should revert if autoMint is not activated", async () => {
    const { subscriptions, meedProgram, redeemable, user1, user2, admin } = await loadFixture(
      deployFixture
    );

    // Setup auto_rewards
    auto_rewards[0].promotion = redeemable.address;
    await meedProgram.addAutoMintReward(
      auto_rewards[0].levelRequired,
      auto_rewards[0].promotion,
      auto_rewards[0].tokenId,
      auto_rewards[0].amountRequired
    );

    // Onboard users 1 and 2
    await meedProgram.mint(user1.address);
    await meedProgram.mint(user2.address);

    // Subscribe the owner to the enterprise plan and batch mint 2 tokens
    await subscriptions.subscribe(plan.enterprise, false, { value: pricePerPlan.enterprise });
    const to = [user1.address, user2.address];
    await redeemable.batchMint(tokenId[0], to);

    let temp = await redeemable.getRedeemable(tokenId[0]);
    let currentSupply = Number(temp.circulatingSupply);
    expect(currentSupply).to.equal(2); // 2 minted

    await meedProgram.connect(admin).switchAutoMintStatus(); // deactivate auto mint
    const receipt2 = await redeemable.redeem(user1.address, tokenId[0]);
    await expect(receipt2).to.emit(redeemable, "Redeemed").withArgs(user1.address, tokenId[0]);
    await meedProgram.updateMember(user1.address, amounts[2]);

    temp = await redeemable.getRedeemable(tokenId[0]);
    currentSupply = Number(temp.circulatingSupply);
    expect(currentSupply).to.equal(1); // 2 - 1 burned (still no autoMint)
  });

  it("should handle autoMint if activated and conditions met", async () => {
    const { subscriptions, meedProgram, redeemable, user1, user2, admin } = await loadFixture(
      deployFixture
    );

    // Setup auto_rewards
    auto_rewards[0].promotion = redeemable.address;
    await meedProgram.addAutoMintReward(
      auto_rewards[0].levelRequired,
      auto_rewards[0].promotion,
      auto_rewards[0].tokenId,
      auto_rewards[0].amountRequired
    );

    auto_rewards[1].promotion = redeemable.address;
    await meedProgram.addAutoMintReward(
      auto_rewards[1].levelRequired,
      auto_rewards[1].promotion,
      auto_rewards[1].tokenId,
      auto_rewards[1].amountRequired
    );

    let temp = await redeemable.getRedeemable(tokenId[0]);
    let currentSupply = Number(temp.circulatingSupply);
    expect(currentSupply).to.equal(0); // 0 minted

    // Revert: ciculationSupply = 0
    await expect(redeemable.redeem(user1.address, tokenId[0])).to.be.revertedWithCustomError(
      redeemable,
      "Redeemable__TokenNotRedeemable"
    );

    // Onboard users 1 and 2
    await meedProgram.mint(user1.address);
    await meedProgram.mint(user2.address);

    // Subscribe the owner to the enterprise plan and batch mint 2 tokens
    await subscriptions.subscribe(plan.enterprise, false, { value: pricePerPlan.enterprise });
    const to = [user1.address, user2.address];
    await redeemable.batchMint(tokenId[0], to);

    temp = await redeemable.getRedeemable(tokenId[0]);
    currentSupply = Number(temp.circulatingSupply);
    expect(currentSupply).to.equal(2); // 2 minted

    // 1. Simulate purchase with voucher: no autoMint if purchase amount does not meet requirement
    const receipt = await redeemable.redeem(user1.address, tokenId[0]);
    await expect(receipt).to.emit(redeemable, "Redeemed").withArgs(user1.address, tokenId[0]);
    await meedProgram.updateMember(user1.address, amounts[0]);

    temp = await redeemable.getRedeemable(tokenId[0]);
    currentSupply = Number(temp.circulatingSupply);
    expect(currentSupply).to.equal(1); // 2 minted - 1 burned (no autoMint)

    await redeemable.mint(tokenId[0], user1.address); // mint a new token to user1

    temp = await redeemable.getRedeemable(tokenId[0]);
    currentSupply = Number(temp.circulatingSupply);
    expect(currentSupply).to.equal(2); // 2 circulating

    // 2. No autoMint: conditions met but auto mint deactivated
    await meedProgram.connect(admin).switchAutoMintStatus(); // deactivate auto mint
    const receipt2 = await redeemable.redeem(user1.address, tokenId[0]);
    await expect(receipt2).to.emit(redeemable, "Redeemed").withArgs(user1.address, tokenId[0]);
    await meedProgram.updateMember(user1.address, amounts[2]);

    temp = await redeemable.getRedeemable(tokenId[0]);
    currentSupply = Number(temp.circulatingSupply);
    expect(currentSupply).to.equal(1); // 2 - 1 burned (still no autoMint)

    // Auto mint should work fine if activated and conditions met
    await meedProgram.switchAutoMintStatus(); // Re-activate auto mint
    const receipt3 = await redeemable.redeem(user2.address, tokenId[0]);
    await expect(receipt3).to.emit(redeemable, "Redeemed").withArgs(user2.address, tokenId[0]);
    await meedProgram.updateMember(user2.address, amounts[1]);

    temp = await redeemable.getRedeemable(tokenId[0]);
    currentSupply = Number(temp.circulatingSupply);
    expect(currentSupply).to.equal(1); // last vouchers burned but 1 auto minted

    // check that the correct new vouchers have been minted (amount = 220, lvl 1: tokenId expected = 0)
    // const vouchers_after = await redeemable.getRedeemable(tokenId[0]);
    // expect(Number(vouchers_after.circulatingSupply)).to.equal(1); // 1 newly emitted

    // to its rightful owner
    const vouchers_after_user = await redeemable.balanceOf(user2.address, tokenId[0]);
    expect(Number(vouchers_after_user)).to.equal(1); // 1 new voucher minted
  });

  it("should handle autoMint if activated and conditions met", async () => {
    const { subscriptions, meedProgram, redeemable, user1, user2, user3 } = await loadFixture(
      deployFixture
    );

    // Subscribe the owner to the enterprise plan and batch mint 2 tokens
    await subscriptions.subscribe(plan.pro, false, { value: pricePerPlan.pro });

    // Setup auto_rewards
    auto_rewards[0].promotion = redeemable.address;
    auto_rewards[1].promotion = redeemable.address;
    auto_rewards[2].promotion = redeemable.address;
    auto_rewards[3].promotion = redeemable.address;
    auto_rewards[4].promotion = redeemable.address;

    await meedProgram.addAutoMintReward(
      auto_rewards[0].levelRequired,
      auto_rewards[0].promotion,
      auto_rewards[0].tokenId,
      auto_rewards[0].amountRequired
    );

    await meedProgram.addAutoMintReward(
      auto_rewards[1].levelRequired,
      auto_rewards[1].promotion,
      auto_rewards[1].tokenId,
      auto_rewards[1].amountRequired
    );

    await meedProgram.addAutoMintReward(
      auto_rewards[2].levelRequired,
      auto_rewards[2].promotion,
      auto_rewards[2].tokenId,
      auto_rewards[2].amountRequired
    );

    await meedProgram.addAutoMintReward(
      auto_rewards[3].levelRequired,
      auto_rewards[3].promotion,
      auto_rewards[3].tokenId,
      auto_rewards[3].amountRequired
    );

    await meedProgram.addAutoMintReward(
      auto_rewards[4].levelRequired,
      auto_rewards[4].promotion,
      auto_rewards[4].tokenId,
      auto_rewards[4].amountRequired
    );

    // simulate purchase to level up:
    const levelUpAmounts = [110, 520, 1100, 12000];
    await meedProgram.updateMember(user1.address, levelUpAmounts[0]); // still lvl 1
    await meedProgram.updateMember(user2.address, levelUpAmounts[1]); // lvl 3
    await meedProgram.updateMember(user3.address, levelUpAmounts[3]); // lvl 5

    // check voucher received for user 1
    const vouchers_user1 = await redeemable.balanceOf(user1.address, tokenId[0]);
    expect(Number(vouchers_user1)).to.equal(1); // 1 new voucher minted

    // check voucher received for user 2
    const vouchers_user2 = await redeemable.balanceOf(user2.address, tokenId[0]);
    expect(Number(vouchers_user2)).to.equal(1); // 1 new voucher minted

    // check voucher received for user 3
    const vouchers_user3 = await redeemable.balanceOf(user3.address, tokenId[0]);
    expect(Number(vouchers_user3)).to.equal(1); // 1 new voucher minted

    // simulate new purchase and check vouchers received
    await meedProgram.updateMember(user1.address, amounts[2]); // lvl 2
    await meedProgram.updateMember(user2.address, amounts[4]); // lvl 3
    await meedProgram.updateMember(user3.address, amounts[5]); // lvl 5

    // check voucher received for user 1
    const vouchers2_user1 = await redeemable.balanceOf(user1.address, tokenId[1]);
    expect(Number(vouchers2_user1)).to.equal(1); // 1 new voucher minted

    // check voucher received for user 2
    const vouchers2_user2 = await redeemable.balanceOf(user2.address, tokenId[2]);
    expect(Number(vouchers2_user2)).to.equal(1); // 1 new voucher minted

    // check voucher received for user 3
    const vouchers2_user3 = await redeemable.balanceOf(user3.address, tokenId[4]);
    expect(Number(vouchers2_user3)).to.equal(1); // 1 new voucher minted
  });
});
