// import { BigNumber, utils } from "ethers";
import { BigNumberish, ethers } from "ethers";

export const formatNumber = (num: number): BigNumberish => {
  return ethers.parseUnits(num.toString(), 18);
};

export const parseNumber = (num: BigInt): number => {
  return Number(num) / 10 ** 18;
};

export const compareTimestamp = (value1: number, value2: number) => {
  const contractTimestamp = BigInt(value1);
  const testTimestamp = BigInt(value2);

  const threshold = 120; // Set your threshold in seconds

  if (Math.abs(Number(contractTimestamp - testTimestamp)) <= threshold) {
    return true;
  } else return false;
};

export function bytes16ToString(bytes: string): string {
  let string = "";
  for (let i = 0; i < bytes.length; i += 2) {
    let byte = parseInt(bytes.slice(i, i + 2), 16);
    string += String.fromCharCode(byte);
  }
  return string.trimStart().replace(/\0/g, "");
}
