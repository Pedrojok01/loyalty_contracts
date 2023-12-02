require("@nomicfoundation/hardhat-chai-matchers");
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";

import { pricePerPlan, plan, promoType } from "./helpers/constant";
import { deploy } from "./helpers/deploy";
import { ethers } from "hardhat";

describe("NonExpirable Promotion Contract", function () {
  async function deployFixture() {
    const {
      adminRegistry,
      subscriptions,
      loyaltyProgramFactory,
      nonExpirableFactory,
      loyaltyProgram,
      expirationDate,
      owner,
      user1,
      user2,
      user3,
      admin,
    } = await deploy();

    // Create a new promo via the nonExpirable factory
    const unkownData = 0;
    const loyaltyProgramAddress = await loyaltyProgram.getAddress();
    await nonExpirableFactory.instance.createNewPromotion(
      "NonExpirable",
      "EXP",
      "ipfs://uri",
      loyaltyProgramAddress,
      unkownData,
      promoType.badges,
    );

    // Check the new state  (1 promo)
    const allPromos = await loyaltyProgram.getAllPromotions();
    expect(allPromos.length).to.equal(1);

    const nonExpirable = await ethers.getContractAt("NonExpirable", allPromos[0].promotionAddress);

    return {
      adminRegistry,
      subscriptions,
      loyaltyProgramFactory,
      nonExpirableFactory,
      loyaltyProgram,
      nonExpirable,
      expirationDate,
      owner,
      user1,
      user2,
      user3,
      admin,
    };
  }

  it("should initialise all factories contract correctly", async () => {
    const { loyaltyProgramFactory, nonExpirableFactory, nonExpirable, owner, admin } =
      await loadFixture(deployFixture);

    expect(await loyaltyProgramFactory.instance.factories(1)).to.equal(nonExpirableFactory.address);
    expect(await nonExpirable.name()).to.equal("NonExpirable");
    expect(await nonExpirable.symbol()).to.equal("EXP");
    expect(await nonExpirable.owner()).to.equal(owner.address);
    expect(await nonExpirable.admin()).to.equal(admin.address);
  });

  /*///////////////////////////////////////////////////////////////////////////////
                                MINTING TESTS
    ///////////////////////////////////////////////////////////////////////////////*/

  it("should mint a new NFT", async () => {
    const { subscriptions, loyaltyProgram, nonExpirable, user1 } = await loadFixture(deployFixture);

    const initialTokenId = 0;
    const lvlMin = 0;

    // Should revert if not susbcribed
    await expect(nonExpirable.safeMint(user1.address, lvlMin)).to.be.revertedWithCustomError(
      nonExpirable,
      "SubscriberChecks__PleaseSubscribeToProOrEnterpriseFirst",
    );

    // Subscribe owner, then try again
    await subscriptions.instance.subscribe(plan.pro, false, { value: pricePerPlan.pro });

    // Should revert if user doesn't exist yet
    // (The user should have been added automatically to the Loyalty program anyway after a purchase)
    await expect(nonExpirable.safeMint(user1.address, lvlMin)).to.be.revertedWithCustomError(
      nonExpirable,
      "NonExpirable__NonExistantUser",
    );

    // Add user to the Loyalty program
    await loyaltyProgram.mint(user1.address);
    await nonExpirable.safeMint(user1.address, lvlMin);

    const ownerOfToken = await nonExpirable.ownerOf(initialTokenId);
    expect(ownerOfToken).to.equal(user1.address);
  });

  it("should mint a batch of NFTs", async () => {
    const { subscriptions, loyaltyProgram, nonExpirable, user1, user2, user3 } =
      await loadFixture(deployFixture);

    const to = [user1.address, user2.address, user3.address];
    const lvlMin = 1;

    // Subscribe owner, then add redeeeemable NFTs, then add users to the Loyalty program
    await subscriptions.instance.subscribe(plan.basic, false, { value: pricePerPlan.basic });
    await loyaltyProgram.mint(user1.address);
    await loyaltyProgram.mint(user2.address);
    await loyaltyProgram.mint(user3.address);

    // Try batch minting without plan requirement
    await expect(nonExpirable.connect(user1).batchMint(to, lvlMin)).to.be.revertedWithCustomError(
      nonExpirable,
      "Adminable__NotAuthorized",
    );

    await expect(nonExpirable.batchMint(to, lvlMin)).to.be.revertedWithCustomError(
      nonExpirable,
      "SubscriberChecks__PleaseSubscribeToEnterpriseFirst",
    );

    // Upgrade plan, then try again
    const tokenId = 1;
    const [, toPayMore] = await subscriptions.instance.getRemainingTimeAndPrice(
      tokenId,
      plan.enterprise,
    );
    await subscriptions.instance.changeSubscriptionPlan(tokenId, plan.enterprise, {
      value: toPayMore,
    });
    await nonExpirable.batchMint(to, lvlMin);

    const ownerOfToken1 = await nonExpirable.ownerOf(0);
    expect(ownerOfToken1).to.equal(user1.address);

    const ownerOfToken2 = await nonExpirable.ownerOf(1);
    expect(ownerOfToken2).to.equal(user2.address);

    const ownerOfToken3 = await nonExpirable.ownerOf(2);
    expect(ownerOfToken3).to.equal(user3.address);
  });

  it("should consume a ticket", async () => {
    const { subscriptions, loyaltyProgram, nonExpirable, user1, user2 } =
      await loadFixture(deployFixture);

    const tokenId_0 = 0;
    const tokenId_1 = 1;
    const lvlMin = 0;

    // Subscribe, hen add users to the Loyalty program
    await subscriptions.instance.subscribe(plan.enterprise, true, {
      value: pricePerPlan.enterprise * 10n,
    });
    await loyaltyProgram.mint(user1.address);
    await loyaltyProgram.mint(user2.address);

    await nonExpirable.safeMint(user1.address, lvlMin);
    await nonExpirable.safeMint(user2.address, lvlMin);

    const receipt = await nonExpirable.consumeTiket(user1.address, tokenId_0);
    await expect(receipt)
      .to.emit(nonExpirable, "TicketConsumed")
      .withArgs(user1.address, tokenId_0);

    const receipt2 = await nonExpirable.consumeTiket(user2.address, tokenId_1);
    await expect(receipt2)
      .to.emit(nonExpirable, "TicketConsumed")
      .withArgs(user2.address, tokenId_1);
  });

  it("should return tickets per address", async () => {
    const { subscriptions, loyaltyProgram, nonExpirable, user1 } = await loadFixture(deployFixture);

    const tokenId_0 = 0;
    const lvlMin = 0;

    // Subscribe, hen add user to the Loyalty program
    await subscriptions.instance.subscribe(plan.enterprise, true, {
      value: pricePerPlan.enterprise * 10n,
    });
    await loyaltyProgram.mint(user1.address);

    await nonExpirable.safeMint(user1.address, lvlMin);

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
