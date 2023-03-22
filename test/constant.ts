import { formatNumber } from "./helpers/utils";
import { PromiseOrValue } from "../typechain-types/common";
import { BigNumberish, utils } from "ethers";

export const plan = {
  basic: 0,
  pro: 1,
  enterprise: 2,
};

export const promoType = {
  discountVouchers: 0,
  freeProducts: 1,
  collectibles: 2,
  eventTickets: 3,
  vipPass: 4,
  bundles: 5,
};

export const pricePerPlan = {
  basic: utils.parseEther("0.05"),
  pro: utils.parseEther("0.1"),
  enterprise: utils.parseEther("0.5"),
};

export const duration = {
  month: 30 * 24 * 3600,
  year: 365 * 24 * 3600,
};

export const public_mint_price = formatNumber(0.1);

// For Promotions Factories
export const subscriptionAddress = "";

// For Subscriptions NFTs
export const subscriptions_name = "Meed Program Owner";
export const subscriptions_symbol = "MPO";
export const subscriptions_uris: [PromiseOrValue<string>, PromiseOrValue<string>, PromiseOrValue<string>] = [
  "",
  "",
  "",
];

// For MeedProgram NFTs
export const meedProgram_name = "Meed Program";
export const meedProgram_symbol = "MP";
export const meedProgram_uri: PromiseOrValue<string> = "ipfs://Qm.../";
export const meedProgram_amounts: [
  PromiseOrValue<BigNumberish>,
  PromiseOrValue<BigNumberish>,
  PromiseOrValue<BigNumberish>,
  PromiseOrValue<BigNumberish>
] = [100, 500, 1000, 10_000];
