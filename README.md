<div align="center">

<h1><strong>Loyalty - Smart Contracts</strong></h1>

[![Stargazers](https://img.shields.io/github/stars/Pedrojok01/loyalty_contracts)](https://github.com/Pedrojok01/loyalty_contracts/stargazers)
[![Issues](https://img.shields.io/github/issues/Pedrojok01/loyalty_contracts)](https://github.com/Pedrojok01/loyalty_contracts/issues)
[![MIT License](https://img.shields.io/github/license/Pedrojok01/loyalty_contracts)](https://github.com/Pedrojok01/loyalty_contracts/blob/main/License)

</div>

## Description

Initial Smart Contracts draft associated with the Loyalty project. Not to be used for production (yet!).

## Compile:

Make sure to uncomment the following line in `hardhat.config.js`:

```js
solidity: {
    settings: {
        viaIR: true,
    },
  },
```

then run:

```shell
yarn compile
```

## Test:

```shell
yarn test
```

## Slither-analyzer:

[Slither](https://github.com/crytic/slither) is a Solidity static analysis framework written in Python 3. It runs a suite of vulnerability detectors, prints visual information about contract details, and provides an API to easily write custom analyses. Slither enables developers to find vulnerabilities, enhance their code comprehension, and quickly prototype custom analyses.

```shell
yarn slither
```

## Coverage:

Make sure to comment the following line in `hardhat.config.js`:

```js
solidity: {
    settings: {
       // viaIR: true,
    },
  },
```

then run:

```shell
yarn cover
```

## Deploy:

```shell
yarn deploy
```

## Left To Add:

- [x] Credits features
- [ ] Limit number of promotions per tier (override exisiting promo)
- [ ] Limit airdrop size per tier
- [ ] Add interface support for Subscriptions
- [ ] Add URI per vouchers in Redeemable?
- [ ] Finish Non-Expirable & Collectibles promotions
- [ ] Add Marketing / Referral / Partnerships features (array/mapping of promo/program?)
