/* Variables to edit before deployment:
 ***************************************/

import { PromiseOrValue } from "../typechain-types/common";

// For Factories
export const subscriptionAddress = "0xa92EA6d6b6276a72700DdB1C50b246C2eDbdFa06"; // v1 on mumbai - temp - not verified

export const redeemableFactoryAddress = "0x29C0655544BA616Fe4DA9F4fd4e03b7eCaD05FfA"; // v1 on mumbai - temp - not verified
export const expirableFactoryAddress = "0x556C32652D8A8b23B66a3BC8430DD338AF89ce26"; // v1 on mumbai - temp - not verified
export const collectibleFactoryAddress = "";
export const bundlesFactoryAddress = "";

// For Subscriptions NFTs
export const subscriptions_name = "Meed Program Owner";
export const subscriptions_symbol = "MPO";
export const subscriptions_uris: [PromiseOrValue<string>, PromiseOrValue<string>, PromiseOrValue<string>] = [
  "",
  "",
  "",
];
