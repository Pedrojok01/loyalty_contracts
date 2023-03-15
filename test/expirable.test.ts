require("@nomicfoundation/hardhat-chai-matchers");
import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";
import {
  BundlesFactory,
  ExpirableFactory,
  MeedProgram,
  MeedProgramFactory,
  RedeemableFactory,
  Subscriptions,
} from "../typechain-types";
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

    const ExpirableFactory = await ethers.getContractFactory("ExpirableFactory");
    const expirableFactory: ExpirableFactory = await ExpirableFactory.deploy(subscriptions.address);
    await expirableFactory.deployed();

    const BundlesFactory = await ethers.getContractFactory("BundlesFactory");
    const bundlesFactory: BundlesFactory = await BundlesFactory.deploy(subscriptions.address);
    await bundlesFactory.deployed();

    const MeedProgramFactory = await ethers.getContractFactory("MeedProgramFactory");
    const meedProgramFactory: MeedProgramFactory = await MeedProgramFactory.deploy([
      redeemableFactory.address,
      expirableFactory.address,
      bundlesFactory.address,
    ]);
    await meedProgramFactory.deployed();

    return {
      meedProgramFactory,
      redeemableFactory,
      expirableFactory,
      bundlesFactory,
      owner,
      user1,
      user2,
      user3,
      admin,
    };
  }

  it("should initialise all factories contract correctly", async () => {
    const { meedProgramFactory, redeemableFactory, expirableFactory, bundlesFactory } = await loadFixture(
      deployFixture
    );

    expect(await meedProgramFactory.factories(0)).to.equal(redeemableFactory.address);
    expect(await meedProgramFactory.factories(1)).to.equal(expirableFactory.address);
    expect(await meedProgramFactory.factories(2)).to.equal(bundlesFactory.address);
  });

  /*///////////////////////////////////////////////////////////////////////////////
                                CREATE NEW MEED PROGRAM
    ///////////////////////////////////////////////////////////////////////////////*/
});
