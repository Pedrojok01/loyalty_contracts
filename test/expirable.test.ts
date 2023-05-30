require("@nomicfoundation/hardhat-chai-matchers");
import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";
import { NonExpirable, NonExpirableFactory, MeedProgram, MeedProgramFactory, Subscriptions } from "../typechain-types";
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
  promoType,
} from "./constant";
import { utils } from "ethers";

describe("NonExpirable Promotion Contract", function () {
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

    const AdminRegistry = await ethers.getContractFactory("AdminRegistry");
    const adminRegistry = await AdminRegistry.deploy(admin.address);
    await adminRegistry.deployed();

    const NonExpirableFactory = await ethers.getContractFactory("NonExpirableFactory");
    const nonExpirableFactory: NonExpirableFactory = await NonExpirableFactory.deploy(
      subscriptions.address,
      adminRegistry.address
    );
    await nonExpirableFactory.deployed();

    const MeedProgramFactory = await ethers.getContractFactory("MeedProgramFactory");
    const meedProgramFactory: MeedProgramFactory = await MeedProgramFactory.deploy(adminRegistry.address, [
      nonExpirableFactory.address,
      nonExpirableFactory.address,
      nonExpirableFactory.address,
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
    const unkownData = 0;
    await nonExpirableFactory.createNewPromotion(
      "NonExpirable",
      "EXP",
      "ipfs://uri",
      meedProgramAddress,
      unkownData,
      promoType.badges
    );

    const meedProgram = await ethers.getContractAt("MeedProgram", meedProgramAddress);

    // Check the new state  (1 promo)
    const allPromos = await meedProgram.getAllPromotions();
    expect(allPromos.length).to.equal(1);

    const nonExpirable = await ethers.getContractAt("NonExpirable", allPromos[0].promotionAddress);

    return {
      subscriptions,
      meedProgramFactory,
      nonExpirableFactory,
      meedProgram,
      nonExpirable,
      owner,
      user1,
      user2,
      user3,
      admin,
    };
  }

  it("should initialise all factories contract correctly", async () => {
    const { meedProgramFactory, nonExpirableFactory, nonExpirable, owner, admin } = await loadFixture(deployFixture);

    expect(await meedProgramFactory.factories(1)).to.equal(nonExpirableFactory.address);
    expect(await nonExpirable.name()).to.equal("NonExpirable");
    expect(await nonExpirable.symbol()).to.equal("EXP");
    expect(await nonExpirable.owner()).to.equal(owner.address);
    expect(await nonExpirable.admin()).to.equal(admin.address);
  });

  /*///////////////////////////////////////////////////////////////////////////////
                                MINTING TESTS
    ///////////////////////////////////////////////////////////////////////////////*/

  it("should mint a new NFT", async () => {
    const { subscriptions, meedProgram, nonExpirable, owner, user1, user2 } = await loadFixture(deployFixture);

    const initialTokenId = 0;
    const lvlMin = 0;

    // Should revert if not susbcribed
    await expect(nonExpirable.connect(owner).safeMint(user1.address, lvlMin)).to.be.revertedWithCustomError(
      nonExpirable,
      "SubscriberChecks__PleaseSubscribeToProOrEnterpriseFirst"
    );

    // Subscribe owner, then try again
    await subscriptions.connect(owner).subscribe(1, false, { value: pricePerPlan.pro });

    // Should revert if user doesn't exist yet
    // (The user should have been added automatically to the Meed program anyway after a purchase)
    await expect(nonExpirable.connect(owner).safeMint(user1.address, lvlMin)).to.be.revertedWithCustomError(
      nonExpirable,
      "NonExpirable__NonExistantUser"
    );

    // Add user to the Meed program
    await meedProgram.connect(owner).mint(user1.address);
    await nonExpirable.connect(owner).safeMint(user1.address, lvlMin);

    const ownerOfToken = await nonExpirable.ownerOf(initialTokenId);
    expect(ownerOfToken).to.equal(user1.address);
  });

  it("should mint a batch of NFTs", async () => {
    const { subscriptions, meedProgram, nonExpirable, owner, user1, user2, user3 } = await loadFixture(deployFixture);

    const to = [user1.address, user2.address, user3.address];
    const lvlMin = 1;

    // Subscribe owner, then add redeeeemable NFTs, then add users to the Meed program
    await subscriptions.connect(owner).subscribe(plan.basic, false, { value: pricePerPlan.basic });
    await meedProgram.connect(owner).mint(user1.address);
    await meedProgram.connect(owner).mint(user2.address);
    await meedProgram.connect(owner).mint(user3.address);

    // Try batch minting without plan requirement
    await expect(nonExpirable.connect(user1).batchMint(to, lvlMin)).to.be.revertedWithCustomError(
      nonExpirable,
      "Adminable__NotAuthorized"
    );

    await expect(nonExpirable.connect(owner).batchMint(to, lvlMin)).to.be.revertedWithCustomError(
      nonExpirable,
      "SubscriberChecks__PleaseSubscribeToEnterpriseFirst"
    );

    // Upgrade plan, then try again
    const tokenId = 1;
    const [, toPayMore] = await subscriptions.getRemainingTimeAndPrice(tokenId, plan.enterprise);
    await subscriptions.connect(owner).changeSubscriptionPlan(tokenId, plan.enterprise, { value: toPayMore });
    await nonExpirable.connect(owner).batchMint(to, lvlMin);

    const ownerOfToken1 = await nonExpirable.ownerOf(0);
    expect(ownerOfToken1).to.equal(user1.address);

    const ownerOfToken2 = await nonExpirable.ownerOf(1);
    expect(ownerOfToken2).to.equal(user2.address);

    const ownerOfToken3 = await nonExpirable.ownerOf(2);
    expect(ownerOfToken3).to.equal(user3.address);
  });

  it("should consume a ticket", async () => {
    const { subscriptions, meedProgram, nonExpirable, owner, user1, user2 } = await loadFixture(deployFixture);

    const tokenId_0 = 0;
    const tokenId_1 = 1;
    const lvlMin = 0;

    // Subscribe, hen add users to the Meed program
    await subscriptions.connect(owner).subscribe(plan.enterprise, true, { value: pricePerPlan.enterprise.mul(10) });
    await meedProgram.connect(owner).mint(user1.address);
    await meedProgram.connect(owner).mint(user2.address);

    await nonExpirable.connect(owner).safeMint(user1.address, lvlMin);
    await nonExpirable.connect(owner).safeMint(user2.address, lvlMin);

    const receipt = await nonExpirable.connect(owner).consumeTiket(user1.address, tokenId_0);
    await expect(receipt).to.emit(nonExpirable, "TicketConsumed").withArgs(user1.address, tokenId_0);

    const receipt2 = await nonExpirable.connect(owner).consumeTiket(user2.address, tokenId_1);
    await expect(receipt2).to.emit(nonExpirable, "TicketConsumed").withArgs(user2.address, tokenId_1);
  });

  it("should return tickets per address", async () => {
    const { subscriptions, meedProgram, nonExpirable, owner, user1 } = await loadFixture(deployFixture);

    const tokenId_0 = 0;
    const lvlMin = 0;

    // Subscribe, hen add user to the Meed program
    await subscriptions.connect(owner).subscribe(plan.enterprise, true, { value: pricePerPlan.enterprise.mul(10) });
    await meedProgram.connect(owner).mint(user1.address);

    await nonExpirable.connect(owner).safeMint(user1.address, lvlMin);

    // Check the URI
    expect(await nonExpirable.tokenURI(tokenId_0)).to.equal("ipfs://uri");

    // Get tickets per address, if any
    const tickets = await nonExpirable.getTicketsPerAddress(user1.address);
    expect(tickets.length).to.equal(1);
    expect(tickets[0].used).to.equal(false);
    expect(tickets[0].owner).to.equal(user1.address);

    const ticket = await nonExpirable.getTicket(tokenId_0);
    expect(ticket.used).to.equal(false);
    expect(ticket.owner).to.equal(user1.address);
  });
});
