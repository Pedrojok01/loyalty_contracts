/* Variables to edit before deployment:
 ***************************************/

import { PromiseOrValue } from "../typechain-types/common";

export const ADMIN_ADDRESS = "0xf0eeaab7153ff42849acb0e817efee09fb078c1b";

// For Factories
export const subscriptionAddress = "0xa92EA6d6b6276a72700DdB1C50b246C2eDbdFa06"; // v1 on mumbai - temp - not verified

export const redeemableFactoryAddress = "0x9f001da4E68077A0fD25e38aa36D07eA42eBf491"; // v1 on mumbai - temp - not verified
export const nonExpirableFactoryAddress = "0x45a63C7051854DBE47a119cc3523c951cEcB1C7D"; // v1 on mumbai - temp - not verified
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
