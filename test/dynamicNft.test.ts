require("@nomicfoundation/hardhat-chai-matchers");
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { DynamicNft } from "../typechain-types";
import { duration, public_mint_price } from "./constant";
import { formatNumber, parseNumber } from "./helpers/utils";
import { BigNumber } from "ethers";
import { getTreeRoot } from "./helpers/proofHelpers";

describe("LepriconStaking", function () {
    let
        dynamicNft: DynamicNft,
        deployer: SignerWithAddress,
        user1: SignerWithAddress,
        user2: SignerWithAddress,
        user3: SignerWithAddress,
        admin: SignerWithAddress;

    // eslint-disable-next-line
    before(async function () {
        [deployer, user1, user2, user3, admin] = await ethers.getSigners();

        const merkle_root = getTreeRoot();

        const DynamicNft = await ethers.getContractFactory("DynamicNft");
        dynamicNft = await DynamicNft.deploy(merkle_root, ["", "", "", "", ""]);
        await dynamicNft.deployed();
    });

    it("should initialise the contract correctly", async () => {
        expect(await dynamicNft.owner()).to.equal(deployer);
    });

    /*///////////////////////////////////////////////////////////////////////////////
                                    PRIVATE MINT
    ///////////////////////////////////////////////////////////////////////////////*/
    it("should reject a non-whitelisted address to private_mint", async () => {

    });

    it("should allow a whitelisted address to private_mint", async () => {

    });

    /*///////////////////////////////////////////////////////////////////////////////
                                    PUBLIC MINT
    ///////////////////////////////////////////////////////////////////////////////*/
    it("should should be possible to open/close the public_mint", async () => {

    });

    it("should revert anyone to public_mint if a wrong value is sent", async () => {

    });

    it("should allow anyone to public_mint if the correct value is sent", async () => {

    });

    it("shouldn't be possible to mint once the max-supply has been reached", async () => {

    });

    /*///////////////////////////////////////////////////////////////////////////////
                                    DYNAMIC URIs
    ///////////////////////////////////////////////////////////////////////////////*/
    it("should return the correct URI for each NFT", async () => {

    });


});
