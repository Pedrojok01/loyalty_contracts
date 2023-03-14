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
import { utils } from "ethers";
import { bytes16ToString } from "./helpers/utils";

describe("Promotions Factories Contract", function () {
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

  it("should create a new Meed Program and store it correctly", async () => {
    const { meedProgramFactory, owner } = await loadFixture(deployFixture);

    await meedProgramFactory.createNewMeedProgram(
      meedProgram_name,
      meedProgram_symbol,
      meedProgram_uri,
      false,
      meedProgram_amounts,
      utils.formatBytes32String("food"),
      utils.formatBytes32String("HK")
    );

    // Total amount of programs should be 1
    let totalMeedPrograms = await meedProgramFactory.getTotalMeedPrograms();
    expect(Number(totalMeedPrograms)).to.equal(1);

    const receipt = await meedProgramFactory.createNewMeedProgram(
      "new_name_II",
      meedProgram_symbol,
      meedProgram_uri,
      true,
      meedProgram_amounts,
      utils.formatBytes32String("shoes"),
      utils.formatBytes32String("BKK")
    );

    await expect(receipt)
      .to.emit(meedProgramFactory, "NewMeedProgramCreated")
      .withArgs(owner.address, anyValue, 1, "new_name_II");

    // Total amount of programs should be 1
    totalMeedPrograms = await meedProgramFactory.getTotalMeedPrograms();
    expect(Number(totalMeedPrograms)).to.equal(2);

    // Address of program 1 should be the same as the address of the event
    const meedProgramAddress = await meedProgramFactory.getMeedProgramPerIndex(0);
    const meedIds = await meedProgramFactory.getMeedIDPerOwner(owner.address);
    const meedProgram = await meedProgramFactory.getMeedAddressPerId(meedIds[0]);
    expect(meedProgram).to.equal(meedProgramAddress);

    // Check that the meed program's name return the correct id:
    expect(await meedProgramFactory.getMeedIDPerName(meedProgram_name)).to.equal(0);
  });

  it("shouldn't be possible to create 2 program with the same name", async () => {
    const { meedProgramFactory } = await loadFixture(deployFixture);

    // Program at array 0 (won't revert since array 0 bug)
    await meedProgramFactory.createNewMeedProgram(
      meedProgram_name,
      meedProgram_symbol,
      meedProgram_uri,
      false,
      meedProgram_amounts,
      utils.formatBytes32String("food"),
      utils.formatBytes32String("HK")
    );

    // Need to create at least 2 program for the name check to work:
    await meedProgramFactory.createNewMeedProgram(
      "new_name_II",
      meedProgram_symbol,
      meedProgram_uri,
      false,
      meedProgram_amounts,
      utils.formatBytes32String("food"),
      utils.formatBytes32String("HK")
    );

    // revert if same name
    await expect(
      meedProgramFactory.createNewMeedProgram(
        "new_name_II",
        meedProgram_symbol,
        meedProgram_uri,
        false,
        meedProgram_amounts,
        utils.formatBytes32String("food"),
        utils.formatBytes32String("HK")
      )
    ).to.be.revertedWithCustomError(meedProgramFactory, "MeedProgramFactory_NameAlreadyTaken");
  });

  it("should add the program the the Brands struct properly", async () => {
    const { meedProgramFactory, owner } = await loadFixture(deployFixture);

    await meedProgramFactory.createNewMeedProgram(
      meedProgram_name,
      meedProgram_symbol,
      meedProgram_uri,
      false,
      meedProgram_amounts,
      utils.formatBytes32String("food"),
      utils.formatBytes32String("HK")
    );

    const brandDetails = await meedProgramFactory.getBrandDetails(0);

    expect(bytes16ToString(brandDetails.productType)).to.equal("food");
    expect(bytes16ToString(brandDetails.location)).to.equal("HK");
    expect(brandDetails.owner).to.equal(owner.address);
  });
});
