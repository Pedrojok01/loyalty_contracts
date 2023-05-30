require("@nomicfoundation/hardhat-chai-matchers");
import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { Redeemable, MeedProgramFactory, RedeemableFactory, Subscriptions } from "../typechain-types";
import {
  pricePerPlan,
  meedProgram_name,
  meedProgram_symbol,
  meedProgram_uri,
  duration,
  meedProgram_amounts,
  subscriptions_name,
  subscriptions_symbol,
  subscriptions_uris,
  plan,
  voucher_type,
} from "./constant";
import { utils } from "ethers";

describe("Redeemable Promotion Contract", function () {
  async function deployFixture() {
    const [owner, user1, user2, user3, admin] = await ethers.getSigners();

    const Subscriptions = await ethers.getContractFactory("Subscriptions");
    const subscriptions: Subscriptions = await Subscriptions.deploy(
      subscriptions_name,
      subscriptions_symbol,
      subscriptions_uris,
      admin.address
    );
    await subscriptions.deployed();

    const RedeemCodeLib = await ethers.getContractFactory("RedeemCodeLib");
    const redeemCodeLib = await RedeemCodeLib.deploy();
    await redeemCodeLib.deployed();

    const AdminRegistry = await ethers.getContractFactory("AdminRegistry");
    const adminRegistry = await AdminRegistry.deploy(admin.address);
    await adminRegistry.deployed();

    const RedeemableFactory = await ethers.getContractFactory("RedeemableFactory", {
      libraries: {
        RedeemCodeLib: redeemCodeLib.address,
      },
    });
    const redeemableFactory: RedeemableFactory = await RedeemableFactory.deploy(
      subscriptions.address,
      adminRegistry.address
    );
    await redeemableFactory.deployed();

    const MeedProgramFactory = await ethers.getContractFactory("MeedProgramFactory");
    const meedProgramFactory: MeedProgramFactory = await MeedProgramFactory.deploy(adminRegistry.address, [
      redeemableFactory.address,
      redeemableFactory.address,
      redeemableFactory.address,
    ]);
    await meedProgramFactory.deployed();

    await adminRegistry.connect(admin).setMeedFactoryAddress(meedProgramFactory.address);

    await meedProgramFactory.createNewMeedProgram(
      meedProgram_name,
      meedProgram_symbol,
      meedProgram_uri,
      false,
      meedProgram_amounts,
      utils.formatBytes32String("food"),
      utils.formatBytes32String("HK")
    );

    const meedProgramAddress = await meedProgramFactory.getMeedProgramPerIndex(0);

    // 2. Create a new promo via the redeemable factory
    const startDate = Math.floor(Date.now() / 1000).toString();
    const expirationDate = (Math.floor(Date.now() / 1000) + duration.year).toString();
    await redeemableFactory.createNewPromotion("ipfs://uri", startDate, expirationDate, meedProgramAddress, 1);

    const meedProgram = await ethers.getContractAt("MeedProgram", meedProgramAddress);

    // Check the new state  (1 promo)
    const allPromos = await meedProgram.getAllPromotions();
    expect(allPromos.length).to.equal(1);

    const redeemable: Redeemable = await ethers.getContractAt("Redeemable", allPromos[0].promotionAddress);

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
    const { meedProgramFactory, redeemableFactory, redeemable, owner } = await loadFixture(deployFixture);

    expect(await meedProgramFactory.factories(0)).to.equal(redeemableFactory.address);
    expect(await redeemable.owner()).to.equal(owner.address);
  });

  it("should revert when adding new promo if invalid expiration date", async () => {
    const { meedProgramFactory, redeemableFactory, redeemable, owner } = await loadFixture(deployFixture);

    const meedProgramAddress = await meedProgramFactory.getMeedProgramPerIndex(0);
    const startDate = Math.floor(Date.now() / 1000).toString();
    const expirationDate = (Math.floor(Date.now() / 1000) - duration.month).toString();

    await expect(
      redeemableFactory.createNewPromotion("ipfs://uri", startDate, expirationDate, meedProgramAddress, 1)
    ).to.be.revertedWith("Redeemable: invalid date");
  });

  /*///////////////////////////////////////////////////////////////////////////////
                                    ADMINABLE
    ///////////////////////////////////////////////////////////////////////////////*/

  it("should be possible to add new redeemable NFTs as admin", async () => {
    const { adminRegistry, redeemable, owner, user1, user2, admin } = await loadFixture(deployFixture);

    await expect(
      redeemable.connect(user1).addNewRedeemableNFT(1, 10, utils.formatBytes32String("percent"))
    ).to.be.revertedWithCustomError(redeemable, "Adminable__NotAuthorized");

    // Add new redeemable NFT as admin
    await redeemable.connect(admin).addNewRedeemableNFT(1, 10, utils.formatBytes32String("percent"));

    // Remove the adminship
    await expect(adminRegistry.connect(admin).switchAdminStatus()).to.be.revertedWithCustomError(
      adminRegistry,
      "AdminRegistry__UserNotRegistered"
    );

    const receipt2 = await adminRegistry.connect(owner).switchAdminStatus();
    const userOptedOut = true;
    await expect(receipt2).to.emit(adminRegistry, "UserOptOutStatusChanged").withArgs(owner.address, userOptedOut);

    await expect(
      redeemable.connect(admin).addNewRedeemableNFT(1, 20, utils.formatBytes32String("percent"))
    ).to.be.revertedWithCustomError(redeemable, "Adminable__UserOptedOut");

    // Add the adminship back
    await expect(adminRegistry.connect(user1).switchAdminStatus()).to.be.revertedWithCustomError(
      adminRegistry,
      "AdminRegistry__UserNotRegistered"
    );

    const receipt3 = await adminRegistry.connect(owner).switchAdminStatus();
    await expect(receipt3).to.emit(adminRegistry, "UserOptOutStatusChanged").withArgs(owner.address, !userOptedOut);
  });

  /*///////////////////////////////////////////////////////////////////////////////
                            ADD & MINT NEW REDEEMABLE TYPE
    ///////////////////////////////////////////////////////////////////////////////*/

  it("should be possible to add new redeemable NFTs", async () => {
    const { redeemable, owner, user1 } = await loadFixture(deployFixture);

    await expect(
      redeemable.connect(user1).addNewRedeemableNFT(1, 10, utils.formatBytes32String("percent"))
    ).to.be.revertedWithCustomError(redeemable, "Adminable__NotAuthorized");

    await redeemable.connect(owner).addNewRedeemableNFT(1, 10, utils.formatBytes32String("percent"));
  });

  it("shouldn't be possible to mint under following conditions", async () => {
    const { subscriptions, meedProgram, redeemable, owner, user1 } = await loadFixture(deployFixture);

    await redeemable.connect(owner).addNewRedeemableNFT(1, 10, utils.formatBytes32String("percent"));
    await subscriptions.connect(owner).subscribe(plan.basic, false, { value: pricePerPlan.basic });

    // Add user to the Meed program
    await meedProgram.connect(owner).mint(user1.address);

    // Try sending reward to user
    await expect(redeemable.connect(user1).mint(1, user1.address, 1)).to.be.revertedWithCustomError(
      redeemable,
      "Adminable__NotAuthorized"
    );

    await expect(redeemable.connect(owner).mint(1, user1.address, 1)).to.be.revertedWithCustomError(
      redeemable,
      "Redeemable__WrongId"
    );

    // Moves forward 24 months:
    await time.increase(duration.month * 24);
    await expect(redeemable.connect(owner).mint(0, user1.address, 1)).to.be.revertedWithCustomError(
      redeemable,
      "NonExpirable__EventExpired"
    );
  });

  it("should be possible to mint redeemable NFTs", async () => {
    const { subscriptions, meedProgram, redeemable, owner, user1 } = await loadFixture(deployFixture);

    await redeemable.connect(owner).addNewRedeemableNFT(1, 10, utils.formatBytes32String("percent"));
    await redeemable.connect(owner).addNewRedeemableNFT(1, 20, utils.formatBytes32String("percent"));
    await redeemable.connect(owner).addNewRedeemableNFT(1, 30, utils.formatBytes32String("percent"));

    // Try minting without level requirement

    // Should revert if not susbcribed
    await expect(redeemable.connect(owner).mint(1, user1.address, 1)).to.be.revertedWithCustomError(
      redeemable,
      "SubscriberChecks__PleaseSubscribeFirst"
    );

    // Subscribe owner, then try again
    await subscriptions.connect(owner).subscribe(plan.basic, false, { value: pricePerPlan.basic });
    const brand = await subscriptions.getSubscriber(owner.address);
    expect(brand.startTime).to.not.equal(0);

    // Should revert if user doesn't exist yet
    // (The user should have been added automatically to the Meed program anyway after a purchase)
    await expect(redeemable.connect(owner).mint(1, user1.address, 1)).to.be.revertedWithCustomError(
      redeemable,
      "Redeemable__NonExistantUser"
    );

    // Add user to the Meed program
    await meedProgram.connect(owner).mint(user1.address);
    // Send reward to user
    await redeemable.connect(owner).mint(1, user1.address, 1);
  });

  it("should be possible to batch mint redeemable NFTs", async () => {
    const { subscriptions, meedProgram, redeemable, owner, user1, user2, user3 } = await loadFixture(deployFixture);

    // Subscribe owner, then add redeeeemable NFTs, then add users to the Meed program
    await subscriptions.connect(owner).subscribe(plan.basic, false, { value: pricePerPlan.basic });
    await redeemable.connect(owner).addNewRedeemableNFT(1, 10, utils.formatBytes32String("percent"));
    await meedProgram.connect(owner).mint(user1.address);
    await meedProgram.connect(owner).mint(user2.address);
    await meedProgram.connect(owner).mint(user3.address);

    // Try batch minting without plan requirement
    const to = [user1.address, user2.address, user3.address];

    await expect(redeemable.connect(user1).batchMint(0, to, 1)).to.be.revertedWithCustomError(
      redeemable,
      "Adminable__NotAuthorized"
    );

    await expect(redeemable.connect(owner).batchMint(0, to, 1)).to.be.revertedWithCustomError(
      redeemable,
      "SubscriberChecks__PleaseSubscribeToProOrEnterpriseFirst"
    );

    // Upgrade plan, then try again
    const tokenId = 1;
    const [, toPayMore] = await subscriptions.getRemainingTimeAndPrice(tokenId, plan.enterprise);
    await subscriptions.connect(owner).changeSubscriptionPlan(tokenId, plan.enterprise, { value: toPayMore });
    await redeemable.connect(owner).batchMint(0, to, 1);
  });

  it("should set everything properly when minting vouchers", async () => {
    const { subscriptions, meedProgram, redeemable, owner, user1, user2 } = await loadFixture(deployFixture);

    const voucher_value = 10;

    // Subscribe owner, then add redeeeemable NFTs, then add users to the Meed program
    await subscriptions.connect(owner).subscribe(plan.basic, false, { value: pricePerPlan.basic });
    await redeemable
      .connect(owner)
      .addNewRedeemableNFT(voucher_type.fiatDiscount, voucher_value, utils.formatBytes32String("percent"));
    await meedProgram.connect(owner).mint(user1.address);
    await meedProgram.connect(owner).mint(user2.address);

    // Batch mint to user 1 and 2
    const to = [user1.address, user2.address];
    const tokenId_0 = 0;
    const tokenId_1 = 1;
    const [, toPayMore] = await subscriptions.getRemainingTimeAndPrice(tokenId_1, plan.enterprise);
    await subscriptions.connect(owner).changeSubscriptionPlan(tokenId_1, plan.enterprise, { value: toPayMore });
    await redeemable.connect(owner).batchMint(0, to, 1);

    // Check that all has been set properly:
    expect(await redeemable.isRedeemable(tokenId_0)).to.equal(true);

    const vouchers_before = await redeemable.getRedeemable(tokenId_0);
    expect(vouchers_before.redeemableType).to.equal(voucher_type.fiatDiscount);
    expect(vouchers_before.id).to.equal(tokenId_0);
    expect(Number(vouchers_before.value)).to.equal(voucher_value);
    expect(Number(vouchers_before.circulatingSupply)).to.equal(2); // 2 vouchers emitted

    expect(await redeemable.getTotalRedeemablesSupply()).to.equal(1); // Number of voucher type (0 to 5)
  });

  it("should be possible to redeem a voucher", async () => {
    const { subscriptions, meedProgram, redeemable, owner, user1, user2 } = await loadFixture(deployFixture);

    const voucher_value = 10;

    // Subscribe owner, then add redeeeemable NFTs, then add users to the Meed program
    await subscriptions.connect(owner).subscribe(plan.basic, false, { value: pricePerPlan.basic });
    await redeemable
      .connect(owner)
      .addNewRedeemableNFT(voucher_type.percentDiscount, voucher_value, utils.formatBytes32String("percent"));
    await meedProgram.connect(owner).mint(user1.address);
    await meedProgram.connect(owner).mint(user2.address);

    // Batch mint to user 1 and 2
    const to = [user1.address, user2.address];
    const tokenId_0 = 0;
    const tokenId_1 = 1;
    const [, toPayMore] = await subscriptions.getRemainingTimeAndPrice(tokenId_1, plan.enterprise);
    await subscriptions.connect(owner).changeSubscriptionPlan(tokenId_1, plan.enterprise, { value: toPayMore });
    await redeemable.connect(owner).batchMint(0, to, 1);

    // Redeem the voucher:
    const amount = 1;
    const receipt = await redeemable.connect(owner).redeem(user1.address, tokenId_0, amount);
    await expect(receipt).to.emit(redeemable, "Redeemed").withArgs(user1.address, tokenId_0);

    const receipt2 = await redeemable.connect(owner).redeem(user2.address, tokenId_0, amount);
    await expect(receipt2).to.emit(redeemable, "Redeemed").withArgs(user2.address, tokenId_0);

    const vouchers_after = await redeemable.getRedeemable(tokenId_0);
    expect(Number(vouchers_after.circulatingSupply)).to.equal(0); // 2 vouchers burned
  });

  it("should be possible to redeem a voucher as admin", async () => {
    const { adminRegistry, subscriptions, meedProgram, redeemable, owner, user1, user2, admin } = await loadFixture(
      deployFixture
    );

    const voucher_value = 10;

    // Subscribe owner, then add redeeeemable NFTs, then add users to the Meed program
    await subscriptions.connect(owner).subscribe(plan.basic, false, { value: pricePerPlan.basic });
    await redeemable
      .connect(owner)
      .addNewRedeemableNFT(voucher_type.percentDiscount, voucher_value, utils.formatBytes32String("percent"));
    await meedProgram.connect(owner).mint(user1.address);
    await meedProgram.connect(owner).mint(user2.address);

    // Batch mint to user 1 and 2 from the admin account
    const to = [user1.address, user2.address];
    const tokenId_0 = 0;
    const tokenId_1 = 1;
    const [, toPayMore] = await subscriptions.getRemainingTimeAndPrice(tokenId_1, plan.enterprise);
    await subscriptions.connect(owner).changeSubscriptionPlan(tokenId_1, plan.enterprise, { value: toPayMore });

    await expect(redeemable.connect(user1).batchMint(0, to, 1)).to.be.revertedWithCustomError(
      redeemable,
      "Adminable__NotAuthorized"
    );

    await redeemable.connect(admin).batchMint(0, to, 1);

    // Redeem the voucher from the admin account:
    const amount = 1;

    await expect(redeemable.connect(user1).redeem(user1.address, tokenId_0, amount)).to.be.revertedWithCustomError(
      redeemable,
      "Adminable__NotAuthorized"
    );

    const receipt = await redeemable.connect(admin).redeem(user1.address, tokenId_0, amount);

    await expect(receipt).to.emit(redeemable, "Redeemed").withArgs(user1.address, tokenId_0);

    const receipt2 = await redeemable.connect(admin).redeem(user2.address, tokenId_0, amount);
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

    const receipt = await redeemable.connect(owner).setURI(newUri);
    await expect(receipt).to.emit(redeemable, "NewURISet").withArgs(newUri);
  });

  /*///////////////////////////////////////////////////////////////////////////////
                                  EXPIRATION DATE
  ///////////////////////////////////////////////////////////////////////////////*/

  it("should be possible to get & update the campaign expiration date", async () => {
    const { redeemable, owner, user1, expirationDate } = await loadFixture(deployFixture);

    // Get & check expiration date:
    const [start, end] = await redeemable.getValidityDate();
    expect(end).to.equal(expirationDate);

    // Update expiration date (revert if unauthorized)):
    const newExpirationDate = (Math.floor(Date.now() / 1000) + duration.year * 2).toString();
    await expect(redeemable.connect(user1).updateExpirationDate(newExpirationDate)).to.be.revertedWithCustomError(
      redeemable,
      "Adminable__NotAuthorized"
    );

    const receipt = await redeemable.connect(owner).updateExpirationDate(newExpirationDate);
    await expect(receipt).to.emit(redeemable, "ExpirationDateUpdated").withArgs(owner.address, newExpirationDate);
  });
});
