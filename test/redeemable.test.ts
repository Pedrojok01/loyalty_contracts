require("@nomicfoundation/hardhat-chai-matchers");
import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

import { pricePerPlan, duration, plan, voucher_type, planDuration } from "./constant";
import { utils } from "ethers";
import { deploy } from "./helpers/deploy";

const type = voucher_type.percentDiscount;
const value = [10, 20, 30];
const levelRequired = 1;
const amountRequired = 100;
const data = utils.formatBytes32String("percent");

describe("Redeemable Promotion Contract", function () {
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

  it("should initialise all contracts correctly", async () => {
    const { meedProgramFactory, redeemableFactory, redeemable, owner } = await loadFixture(
      deployFixture
    );

    expect(await meedProgramFactory.factories(0)).to.equal(redeemableFactory.address);
    expect(await redeemable.owner()).to.equal(owner.address);
  });

  it("should revert when adding new promo if invalid expiration date", async () => {
    const { meedProgramFactory, redeemableFactory } = await loadFixture(deployFixture);

    const meedProgramAddress = await meedProgramFactory.getMeedProgramPerIndex(0);
    const startDate = Math.floor(Date.now() / 1000).toString();
    const expirationDate = (Math.floor(Date.now() / 1000) - duration.month).toString();

    await expect(
      redeemableFactory.createNewPromotion(
        "ipfs://uri",
        startDate,
        expirationDate,
        meedProgramAddress,
        1
      )
    ).to.be.revertedWith("Redeemable: invalid date");
  });

  /*///////////////////////////////////////////////////////////////////////////////
                                    ADMINABLE
    ///////////////////////////////////////////////////////////////////////////////*/

  it("should be possible to add new redeemable NFTs as admin", async () => {
    const { subscriptions, adminRegistry, redeemable, owner, user1, admin } = await loadFixture(
      deployFixture
    );

    await expect(
      redeemable.connect(user1).addNewRedeemableNFT(type, value[0], amountRequired, data)
    ).to.be.revertedWithCustomError(redeemable, "Adminable__NotAuthorized");

    // Add new redeemable NFT as admin with unsubscribed owner
    await expect(
      redeemable.connect(admin).addNewRedeemableNFT(type, value[0], amountRequired, data)
    ).to.be.revertedWithCustomError(redeemable, "SubscriberChecks__PleaseSubscribeFirst");

    // Subscribe then try adding a redeeeemable NFTs
    await subscriptions.subscribe(plan.basic, false, { value: pricePerPlan.basic });

    const receipt = await redeemable
      .connect(admin)
      .addNewRedeemableNFT(type, value[0], amountRequired, data);
    await expect(receipt).to.emit(redeemable, "NewTypeAdded").withArgs(type, value[0], data);

    // Remove the adminship
    await expect(adminRegistry.connect(admin).switchAdminStatus()).to.be.revertedWithCustomError(
      adminRegistry,
      "AdminRegistry__UserNotRegistered"
    );

    const receipt2 = await adminRegistry.switchAdminStatus();
    const userOptedOut = true;
    await expect(receipt2)
      .to.emit(adminRegistry, "UserOptOutStatusChanged")
      .withArgs(owner.address, userOptedOut);

    await expect(
      redeemable.connect(admin).addNewRedeemableNFT(type, value[2], amountRequired, data)
    ).to.be.revertedWithCustomError(redeemable, "Adminable__UserOptedOut");

    // Add the adminship back
    await expect(adminRegistry.connect(user1).switchAdminStatus()).to.be.revertedWithCustomError(
      adminRegistry,
      "AdminRegistry__UserNotRegistered"
    );

    const receipt3 = await adminRegistry.switchAdminStatus();
    await expect(receipt3)
      .to.emit(adminRegistry, "UserOptOutStatusChanged")
      .withArgs(owner.address, !userOptedOut);
  });

  /*///////////////////////////////////////////////////////////////////////////////
                            ADD & MINT NEW REDEEMABLE TYPE
    ///////////////////////////////////////////////////////////////////////////////*/

  it("should be possible to add new redeemable NFTs", async () => {
    const { redeemable, owner, user1 } = await loadFixture(deployFixture);

    await expect(
      redeemable.connect(user1).addNewRedeemableNFT(type, value[0], amountRequired, data)
    ).to.be.revertedWithCustomError(redeemable, "Adminable__NotAuthorized");

    await redeemable.addNewRedeemableNFT(type, value[0], amountRequired, data);
  });

  it("shouldn't be possible to mint under following conditions", async () => {
    const { subscriptions, meedProgram, redeemable, owner, user1 } = await loadFixture(
      deployFixture
    );

    await redeemable.addNewRedeemableNFT(type, value[0], amountRequired, data);
    await subscriptions.subscribe(plan.basic, false, { value: pricePerPlan.basic });

    // Add user to the Meed program
    await meedProgram.mint(user1.address);

    // Try sending reward to user
    await expect(redeemable.connect(user1).mint(1, user1.address)).to.be.revertedWithCustomError(
      redeemable,
      "Adminable__NotAuthorized"
    );

    await expect(redeemable.mint(1, user1.address)).to.be.revertedWithCustomError(
      redeemable,
      "Redeemable__WrongId"
    );

    // Moves forward 24 months:
    await time.increase(duration.month * 24);
    await expect(redeemable.mint(0, user1.address)).to.be.revertedWithCustomError(
      redeemable,
      "NonExpirable__EventExpired"
    );
  });

  it("should be possible to mint redeemable NFTs", async () => {
    const { subscriptions, meedProgram, redeemable, owner, user1 } = await loadFixture(
      deployFixture
    );

    await redeemable.addNewRedeemableNFT(type, value[0], amountRequired, data);
    await redeemable.addNewRedeemableNFT(type, value[1], amountRequired, data);
    await redeemable.addNewRedeemableNFT(type, value[2], amountRequired, data);

    // Try minting without level requirement

    // Should revert if not susbcribed
    await expect(redeemable.mint(1, user1.address)).to.be.revertedWithCustomError(
      redeemable,
      "SubscriberChecks__PleaseSubscribeFirst"
    );

    // Subscribe owner, then try again
    await subscriptions.subscribe(plan.basic, false, { value: pricePerPlan.basic });
    const brand = await subscriptions.getSubscriber(owner.address);
    expect(brand.startTime).to.not.equal(0);

    // Should revert if user doesn't exist yet
    // (The user should have been added automatically to the Meed program anyway after a purchase)
    await expect(redeemable.mint(1, user1.address)).to.be.revertedWithCustomError(
      redeemable,
      "Redeemable__NonExistantUser"
    );

    // Add user to the Meed program
    await meedProgram.mint(user1.address);
    // Send reward to user
    await redeemable.mint(1, user1.address);
  });

  it("should be possible to batch mint redeemable NFTs", async () => {
    const { subscriptions, meedProgram, redeemable, owner, user1, user2, user3 } =
      await loadFixture(deployFixture);

    // Subscribe owner, then add redeeeemable NFTs, then add users to the Meed program
    await subscriptions.subscribe(plan.basic, false, { value: pricePerPlan.basic });
    await redeemable.addNewRedeemableNFT(type, value[2], amountRequired, data);
    await meedProgram.mint(user1.address);
    await meedProgram.mint(user2.address);
    await meedProgram.mint(user3.address);

    // Try batch minting without plan requirement
    const to = [user1.address, user2.address, user3.address];

    await expect(redeemable.connect(user1).batchMint(0, to)).to.be.revertedWithCustomError(
      redeemable,
      "Adminable__NotAuthorized"
    );

    await expect(redeemable.batchMint(0, to)).to.be.revertedWithCustomError(
      redeemable,
      "SubscriberChecks__PleaseSubscribeToProOrEnterpriseFirst"
    );

    // Upgrade plan, then try again
    const tokenId = 1;
    const [, toPayMore] = await subscriptions.getRemainingTimeAndPrice(tokenId, plan.enterprise);
    await subscriptions.changeSubscriptionPlan(tokenId, plan.enterprise, { value: toPayMore });
    await redeemable.batchMint(0, to);
  });

  it("should set everything properly when minting vouchers", async () => {
    const { subscriptions, meedProgram, redeemable, owner, user1, user2 } = await loadFixture(
      deployFixture
    );

    // Subscribe owner, then add redeeeemable NFTs, then add users to the Meed program
    await subscriptions.subscribe(plan.basic, false, { value: pricePerPlan.basic });
    await redeemable.addNewRedeemableNFT(
      voucher_type.fiatDiscount,
      value[0],

      amountRequired,
      data
    );

    await meedProgram.mint(user1.address);
    await meedProgram.mint(user2.address);

    // Batch mint to user 1 and 2
    const to = [user1.address, user2.address];
    const tokenId_0 = 0;
    const tokenId_1 = 1;
    const [, toPayMore] = await subscriptions.getRemainingTimeAndPrice(tokenId_1, plan.enterprise);
    await subscriptions.changeSubscriptionPlan(tokenId_1, plan.enterprise, { value: toPayMore });
    await redeemable.batchMint(0, to);

    // Check that all has been set properly:
    expect(await redeemable.isRedeemable(tokenId_0)).to.equal(true);

    const vouchers_before = await redeemable.getRedeemable(tokenId_0);
    expect(vouchers_before.redeemableType).to.equal(voucher_type.fiatDiscount);
    expect(vouchers_before.id).to.equal(tokenId_0);
    expect(Number(vouchers_before.value)).to.equal(value[0]);
    expect(Number(vouchers_before.circulatingSupply)).to.equal(2); // 2 vouchers emitted

    expect(await redeemable.getTotalRedeemablesSupply()).to.equal(1); // Number of voucher type (0 to 5)
  });

  it("should be possible to redeem a voucher", async () => {
    const { subscriptions, meedProgram, redeemable, owner, user1, user2 } = await loadFixture(
      deployFixture
    );

    // Subscribe owner, then add redeeeemable NFTs, then add users to the Meed program
    await subscriptions.subscribe(plan.basic, false, { value: pricePerPlan.basic });
    await redeemable.addNewRedeemableNFT(type, value[0], amountRequired, data);
    await meedProgram.mint(user1.address);
    await meedProgram.mint(user2.address);

    // Batch mint to user 1 and 2
    const to = [user1.address, user2.address];
    const tokenId_0 = 0;
    const tokenId_1 = 1;
    const [, toPayMore] = await subscriptions.getRemainingTimeAndPrice(tokenId_1, plan.enterprise);
    await subscriptions.changeSubscriptionPlan(tokenId_1, plan.enterprise, { value: toPayMore });
    await redeemable.batchMint(0, to);

    // Redeem the voucher:
    const amount = 1;
    const receipt = await redeemable.redeem(user1.address, tokenId_0);
    await expect(receipt).to.emit(redeemable, "Redeemed").withArgs(user1.address, tokenId_0);

    const receipt2 = await redeemable.redeem(user2.address, tokenId_0);
    await expect(receipt2).to.emit(redeemable, "Redeemed").withArgs(user2.address, tokenId_0);

    const vouchers_after = await redeemable.getRedeemable(tokenId_0);
    expect(Number(vouchers_after.circulatingSupply)).to.equal(0); // 2 vouchers burned
  });

  it("should be possible to redeem a voucher as admin", async () => {
    const { subscriptions, meedProgram, redeemable, owner, user1, user2, admin } =
      await loadFixture(deployFixture);

    // Subscribe owner, then add redeeeemable NFTs, then add users to the Meed program
    await subscriptions.subscribe(plan.basic, planDuration.monthly, { value: pricePerPlan.basic });
    await redeemable.addNewRedeemableNFT(type, value[0], amountRequired, data);
    await meedProgram.mint(user1.address);
    await meedProgram.mint(user2.address);

    // Batch mint to user 1 and 2 from the admin account
    const to = [user1.address, user2.address];
    const tokenId_0 = 0;
    const tokenId_1 = 1;
    const [, toPayMore] = await subscriptions.getRemainingTimeAndPrice(tokenId_1, plan.enterprise);
    await subscriptions.changeSubscriptionPlan(tokenId_1, plan.enterprise, { value: toPayMore });

    await expect(redeemable.connect(user1).batchMint(0, to)).to.be.revertedWithCustomError(
      redeemable,
      "Adminable__NotAuthorized"
    );

    await redeemable.connect(admin).batchMint(0, to);

    // Redeem the voucher from the admin account:
    const amount = 1;

    await expect(
      redeemable.connect(user1).redeem(user1.address, tokenId_0)
    ).to.be.revertedWithCustomError(redeemable, "Adminable__NotAuthorized");

    const receipt = await redeemable.connect(admin).redeem(user1.address, tokenId_0);

    await expect(receipt).to.emit(redeemable, "Redeemed").withArgs(user1.address, tokenId_0);

    const receipt2 = await redeemable.connect(admin).redeem(user2.address, tokenId_0);
    await expect(receipt2).to.emit(redeemable, "Redeemed").withArgs(user2.address, tokenId_0);

    const vouchers_after = await redeemable.getRedeemable(tokenId_0);
    expect(Number(vouchers_after.circulatingSupply)).to.equal(0); // 2 vouchers burned
  });

  it("should be possible to change the URI if authorized", async () => {
    const { redeemable, owner, user1 } = await loadFixture(deployFixture);

    const newUri = "ipfs://new_uri";

    await expect(redeemable.connect(user1).setURI(newUri)).to.be.revertedWithCustomError(
      redeemable,
      "Adminable__NotAuthorized"
    );

    const receipt = await redeemable.setURI(newUri);
    await expect(receipt).to.emit(redeemable, "NewURISet").withArgs(newUri);
  });

  /*///////////////////////////////////////////////////////////////////////////////
                                  REDEEM CODE FEATURE
  ///////////////////////////////////////////////////////////////////////////////*/

  it("should redeem a Voucher from a redeem code", async () => {
    const { subscriptions, meedProgram, redeemable, user1, admin } = await loadFixture(
      deployFixture
    );

    // Subscribe owner, add redeeeemable NFTs, then add users to the Meed program
    await subscriptions.subscribe(plan.pro, false, { value: pricePerPlan.pro });
    await redeemable.addNewRedeemableNFT(type, value[0], amountRequired, data);
    await meedProgram.mint(user1.address);

    // Batch mint to user 1 and 2
    const tokenId = 0;
    await redeemable.mint(tokenId, user1.address);

    const voucher = await redeemable.getRedeemable(tokenId);
    const receipt = await redeemable.redeemFromCode(user1.address, voucher.redeemCode);

    // Assert that the token was burned, etc.
    expect(receipt)
      .to.emit(redeemable, "TransferSingle")
      .withArgs(redeemable.address, user1.address, ethers.constants.AddressZero, tokenId, false);
  });

  it("should revert redeemFromCode if the code is invalid or empty", async () => {
    const { redeemable, user1 } = await loadFixture(deployFixture);

    await expect(redeemable.redeemFromCode(user1.address, "TESTCODE")).to.be.revertedWith(
      "Invalid redeem code"
    );

    await expect(redeemable.redeemFromCode(user1.address, "")).to.be.revertedWith(
      "Invalid redeem code"
    );
  });

  /*///////////////////////////////////////////////////////////////////////////////
                                  EXPIRATION DATE
  ///////////////////////////////////////////////////////////////////////////////*/

  it("should be possible to get & update the campaign expiration date", async () => {
    const { redeemable, owner, user1, expirationDate } = await loadFixture(deployFixture);

    // Get & check expiration date:
    const validity = await redeemable.getValidityDate();

    expect(validity.end).to.equal(expirationDate);

    // Update expiration date (revert if unauthorized)):
    const newExpirationDate = (Math.floor(Date.now() / 1000) + duration.year * 2).toString();
    await expect(
      redeemable.connect(user1).updateExpirationDate(newExpirationDate)
    ).to.be.revertedWithCustomError(redeemable, "Adminable__NotAuthorized");

    const receipt = await redeemable.updateExpirationDate(newExpirationDate);
    await expect(receipt)
      .to.emit(redeemable, "ExpirationDateUpdated")
      .withArgs(expirationDate, newExpirationDate, owner.address);
  });

  it("should be possible to get & update the campaign expiration date", async () => {
    const { redeemable, owner, user1, expirationDate } = await loadFixture(deployFixture);

    // Get & check expiration date:
    const validity = await redeemable.getValidityDate();
    expect(validity.end).to.equal(expirationDate);

    // Update expiration date (revert if unauthorized)):
    const newExpirationDate = (Math.floor(Date.now() / 1000) + duration.year * 2).toString();
    await expect(
      redeemable.connect(user1).updateExpirationDate(newExpirationDate)
    ).to.be.revertedWithCustomError(redeemable, "Adminable__NotAuthorized");

    const receipt = await redeemable.updateExpirationDate(newExpirationDate);
    await expect(receipt)
      .to.emit(redeemable, "ExpirationDateUpdated")
      .withArgs(expirationDate, newExpirationDate, owner.address);
  });
});
