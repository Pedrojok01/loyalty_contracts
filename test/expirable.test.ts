require("@nomicfoundation/hardhat-chai-matchers");
import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";
import { Expirable, ExpirableFactory, MeedProgram, MeedProgramFactory, Subscriptions } from "../typechain-types";
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
} from "./constant";
import { utils } from "ethers";

describe("Expirable Promotion Contract", function () {
  async function deployFixture() {
    const [owner, user1, user2, user3, admin] = await ethers.getSigners();

    const Subscriptions = await ethers.getContractFactory("Subscriptions");
    const subscriptions: Subscriptions = await Subscriptions.deploy(
      subscriptions_name,
      subscriptions_symbol,
      subscriptions_uris
    );
    await subscriptions.deployed();

    const ExpirableFactory = await ethers.getContractFactory("ExpirableFactory");
    const expirableFactory: ExpirableFactory = await ExpirableFactory.deploy(subscriptions.address);
    await expirableFactory.deployed();

    const MeedProgramFactory = await ethers.getContractFactory("MeedProgramFactory");
    const meedProgramFactory: MeedProgramFactory = await MeedProgramFactory.deploy([
      expirableFactory.address,
      expirableFactory.address,
      expirableFactory.address,
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
    await expirableFactory.createNewPromotion("Expirable", "EXP", "ipfs://uri", expirationDate, meedProgramAddress, 2);

    const meedProgram = await ethers.getContractAt("MeedProgram", meedProgramAddress);

    // Check the new state  (1 promo)
    const allPromos = await meedProgram.getAllPromotions();
    expect(allPromos.length).to.equal(1);

    const expirable = await ethers.getContractAt("Expirable", allPromos[0].promotionAddress);

    return {
      subscriptions,
      meedProgramFactory,
      expirableFactory,
      meedProgram,
      expirable,
      owner,
      user1,
      user2,
      user3,
      admin,
    };
  }

  it("should initialise all factories contract correctly", async () => {
    const { meedProgramFactory, expirableFactory, expirable, owner } = await loadFixture(deployFixture);

    expect(await meedProgramFactory.factories(1)).to.equal(expirableFactory.address);
    expect(await expirable.name()).to.equal("Expirable");
    expect(await expirable.symbol()).to.equal("EXP");
    expect(await expirable.owner()).to.equal(owner.address);
    expect(await expirable.admin()).to.equal(owner.address);
    expect(await expirable.isActive()).to.be.true;
  });

  /*///////////////////////////////////////////////////////////////////////////////
                                MINTING TESTS
    ///////////////////////////////////////////////////////////////////////////////*/

  it("should mint a new NFT", async () => {
    const { subscriptions, meedProgram, expirable, owner, user1, user2 } = await loadFixture(deployFixture);

    const initialTokenId = 0;
    const lvlMin = 0;

    // Should revert if not susbcribed
    await expect(expirable.connect(owner).safeMint(user1.address, lvlMin)).to.be.revertedWithCustomError(
      expirable,
      "SubscriberChecks__PleaseSubscribeToProOrEnterpriseFirst"
    );

    // Subscribe owner, then try again
    await subscriptions.connect(owner).subscribe(1, false, { value: pricePerPlan.pro });

    // Should revert if user doesn't exist yet
    // (The user should have been added automatically to the Meed program anyway after a purchase)
    await expect(expirable.connect(owner).safeMint(user1.address, lvlMin)).to.be.revertedWithCustomError(
      expirable,
      "Expirable__NonExistantUser"
    );

    // Add user to the Meed program
    await meedProgram.connect(owner).mint(user1.address);
    await expirable.connect(owner).safeMint(user1.address, lvlMin);

    const ownerOfToken = await expirable.ownerOf(initialTokenId);
    expect(ownerOfToken).to.equal(user1.address);
  });

  it("should mint a batch of NFTs", async () => {
    const { subscriptions, meedProgram, expirable, owner, user1, user2, user3 } = await loadFixture(deployFixture);

    const to = [user1.address, user2.address, user3.address];
    const lvlMin = 1;

    // Subscribe owner, then add redeeeemable NFTs, then add users to the Meed program
    await subscriptions.connect(owner).subscribe(plan.basic, false, { value: pricePerPlan.basic });
    await meedProgram.connect(owner).mint(user1.address);
    await meedProgram.connect(owner).mint(user2.address);
    await meedProgram.connect(owner).mint(user3.address);

    // Try batch minting without plan requirement
    await expect(expirable.connect(user1).batchMint(to, lvlMin)).to.be.revertedWithCustomError(
      expirable,
      "Adminable__NotAuthorized"
    );

    await expect(expirable.connect(owner).batchMint(to, lvlMin)).to.be.revertedWithCustomError(
      expirable,
      "SubscriberChecks__PleaseSubscribeToEnterpriseFirst"
    );

    // Upgrade plan, then try again
    const tokenId = 1;
    const [, toPayMore] = await subscriptions.getRemainingTimeAndPrice(tokenId, plan.enterprise);
    await subscriptions.connect(owner).changeSubscriptionPlan(tokenId, plan.enterprise, { value: toPayMore });
    await expirable.connect(owner).batchMint(to, lvlMin);

    const ownerOfToken1 = await expirable.ownerOf(0);
    expect(ownerOfToken1).to.equal(user1.address);

    const ownerOfToken2 = await expirable.ownerOf(1);
    expect(ownerOfToken2).to.equal(user2.address);

    const ownerOfToken3 = await expirable.ownerOf(2);
    expect(ownerOfToken3).to.equal(user3.address);
  });

  it("should consume a ticket", async () => {
    const { subscriptions, meedProgram, expirable, owner, user1, user2 } = await loadFixture(deployFixture);

    const tokenId_0 = 0;
    const tokenId_1 = 1;
    const lvlMin = 0;

    // Subscribe, hen add users to the Meed program
    await subscriptions.connect(owner).subscribe(plan.enterprise, true, { value: pricePerPlan.enterprise.mul(10) });
    await meedProgram.connect(owner).mint(user1.address);
    await meedProgram.connect(owner).mint(user2.address);

    await expirable.connect(owner).safeMint(user1.address, lvlMin);
    await expirable.connect(owner).safeMint(user2.address, lvlMin);

    const receipt = await expirable.connect(owner).consumeTiket(user1.address, tokenId_0);
    await expect(receipt).to.emit(expirable, "TicketConsumed").withArgs(user1.address, tokenId_0);

    const receipt2 = await expirable.connect(owner).consumeTiket(user2.address, tokenId_1);
    await expect(receipt2).to.emit(expirable, "TicketConsumed").withArgs(user2.address, tokenId_1);
  });

  it("should return tickets per address", async () => {
    const { subscriptions, meedProgram, expirable, owner, user1 } = await loadFixture(deployFixture);

    const tokenId_0 = 0;
    const lvlMin = 0;

    // Subscribe, hen add user to the Meed program
    await subscriptions.connect(owner).subscribe(plan.enterprise, true, { value: pricePerPlan.enterprise.mul(10) });
    await meedProgram.connect(owner).mint(user1.address);

    await expirable.connect(owner).safeMint(user1.address, lvlMin);

    // Check the URI
    expect(await expirable.tokenURI(tokenId_0)).to.equal("ipfs://uri");

    // Get tickets per address, if any
    const tickets = await expirable.getTicketsPerAddress(user1.address);
    expect(tickets.length).to.equal(1);
    expect(tickets[0].used).to.equal(false);
    expect(tickets[0].owner).to.equal(user1.address);

    const ticket = await expirable.getTicket(tokenId_0);
    expect(ticket.used).to.equal(false);
    expect(ticket.owner).to.equal(user1.address);
  });

  it("should deactivate the current promotion if authorized", async () => {
    const { subscriptions, meedProgram, expirable, owner, user1, user2 } = await loadFixture(deployFixture);

    const tokenId_0 = 0;
    const lvlMin = 0;

    // Subscribe, hen add user to the Meed program
    await subscriptions.connect(owner).subscribe(plan.enterprise, true, { value: pricePerPlan.enterprise.mul(10) });
    await meedProgram.connect(owner).mint(user1.address);

    // Should revert if not susbcribed
    await expect(expirable.connect(user1).deactivate()).to.be.revertedWithCustomError(
      expirable,
      "Activation__NotAuthorized"
    );

    const receipt = await expirable.connect(owner).deactivate();
    await expect(receipt).to.emit(expirable, "Deactivated").withArgs(owner.address);
  });
});
