require("@nomicfoundation/hardhat-chai-matchers");
import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
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
} from "./constant";
import { utils } from "ethers";

describe("Redeemable Promotion Contract", function () {
  async function deployFixture() {
    const [owner, user1, user2, user3, admin] = await ethers.getSigners();

    const Subscriptions = await ethers.getContractFactory("Subscriptions");
    const subscriptions: Subscriptions = await Subscriptions.deploy(
      subscriptions_name,
      subscriptions_symbol,
      subscriptions_uris
    );
    await subscriptions.deployed();

    const RedeemableFactory = await ethers.getContractFactory("RedeemableFactory");
    const redeemableFactory: RedeemableFactory = await RedeemableFactory.deploy(subscriptions.address);
    await redeemableFactory.deployed();

    const MeedProgramFactory = await ethers.getContractFactory("MeedProgramFactory");
    const meedProgramFactory: MeedProgramFactory = await MeedProgramFactory.deploy([
      redeemableFactory.address,
      redeemableFactory.address,
      redeemableFactory.address,
    ]);
    await meedProgramFactory.deployed();

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
    const expirationDate = (Math.floor(Date.now() / 1000) + duration.year).toString();
    await redeemableFactory.createNewPromotion("ipfs://uri", expirationDate, meedProgramAddress, 1);

    const meedProgram = await ethers.getContractAt("MeedProgram", meedProgramAddress);

    // Check the new state  (1 promo)
    const allPromos = await meedProgram.getAllPromotions();
    expect(allPromos.length).to.equal(1);

    const redeemable = await ethers.getContractAt("Redeemable", allPromos[0].promotionAddress);

    return {
      subscriptions,
      meedProgramFactory,
      redeemableFactory,
      meedProgram,
      redeemable,
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

  /*///////////////////////////////////////////////////////////////////////////////
                                    ADMINABLE
    ///////////////////////////////////////////////////////////////////////////////*/

  it("should be possible to add new redeemable NFTs as admin", async () => {
    const { redeemable, owner, user1, user2, admin } = await loadFixture(deployFixture);

    // Should revert if not authorized
    await expect(redeemable.connect(user1).transferAdminship(admin.address)).to.be.revertedWithCustomError(
      redeemable,
      "Adminable__NotAuthorized"
    );

    // Should revert if address zero
    await expect(
      redeemable.connect(owner).transferAdminship(ethers.constants.AddressZero)
    ).to.be.revertedWithCustomError(redeemable, "Adminable__AddressZero");

    // Transfer adminship and emit event
    const receipt = await redeemable.connect(owner).transferAdminship(admin.address);
    await expect(receipt).to.emit(redeemable, "AdminshipTransferred").withArgs(owner.address, admin.address);

    await expect(
      redeemable.connect(user1).addNewRedeemableNFT(1, 10, utils.formatBytes32String("percent"))
    ).to.be.revertedWithCustomError(redeemable, "Adminable__NotAuthorized");

    // Add new redeemable NFT as admin
    await redeemable.connect(owner).addNewRedeemableNFT(1, 10, utils.formatBytes32String("percent"));

    // Try to add a second admin, should revert
    await expect(redeemable.connect(owner).addAdminship(user2.address)).to.be.revertedWithCustomError(
      redeemable,
      "Adminable__AdminAlreadySet"
    );

    // Remove the adminship
    await expect(redeemable.connect(admin).removeAdminship()).to.be.revertedWith("Ownable: caller is not the owner");

    const receipt2 = await redeemable.connect(owner).removeAdminship();
    await expect(receipt2)
      .to.emit(redeemable, "AdminshipTransferred")
      .withArgs(admin.address, ethers.constants.AddressZero);

    await expect(
      redeemable.connect(admin).addNewRedeemableNFT(1, 20, utils.formatBytes32String("percent"))
    ).to.be.revertedWithCustomError(redeemable, "Adminable__NotAuthorized");

    // Add the adminship back
    await expect(redeemable.connect(user1).addAdminship(admin.address)).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );

    const receipt3 = await redeemable.connect(owner).addAdminship(admin.address);
    await expect(receipt3)
      .to.emit(redeemable, "AdminshipTransferred")
      .withArgs(ethers.constants.AddressZero, admin.address);
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
    await subscriptions.connect(owner).subscribe(0, false, { value: pricePerPlan.basic });

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
      "Expirable__EventExpired"
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
    await subscriptions.connect(owner).subscribe(0, false, { value: pricePerPlan.basic });
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
    await subscriptions.connect(owner).subscribe(0, false, { value: pricePerPlan.basic });
    await redeemable.connect(owner).addNewRedeemableNFT(1, 10, utils.formatBytes32String("percent"));
    await meedProgram.connect(owner).mint(user1.address);
    await meedProgram.connect(owner).mint(user2.address);
    await meedProgram.connect(owner).mint(user3.address);

    // Try batch minting without plan requirement
    const to = [user1.address, user2.address, user3.address];

    await expect(redeemable.connect(owner).batchMint(0, to, 1)).to.be.revertedWithCustomError(
      redeemable,
      "SubscriberChecks__PleaseSubscribeToProOrEnterpriseFirst"
    );

    // Upgrade plan, then try again
    const [, toPayMore] = await subscriptions.getRemainingTimeAndPrice(1, 2);
    await subscriptions.connect(owner).changeSubscriptionPlan(1, 2, { value: toPayMore });
    await redeemable.connect(owner).batchMint(0, to, 1);
  });
});
