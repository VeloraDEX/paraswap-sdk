[**@velora-dex/sdk**](../README.md) • **Docs**

***

[@velora-dex/sdk](../globals.md) / DeltaPriceParams

# Type Alias: DeltaPriceParams

> **DeltaPriceParams**: `object`

## Type declaration

### amount

> **amount**: `string`

#### Description

srcToken amount in wei

### destChainId?

> `optional` **destChainId**: `number`

#### Description

Destination Chain ID for Crosschain Orders

### destDecimals

> **destDecimals**: `number`

#### Description

Destination Token Decimals

### destToken

> **destToken**: `string`

#### Description

Destination Token Address

### partner?

> `optional` **partner**: `string`

#### Description

Partner string.

### srcDecimals

> **srcDecimals**: `number`

#### Description

Source Token Decimals

### srcToken

> **srcToken**: `string`

#### Description

Source Token Address. Not Native Token

### userAddress?

> `optional` **userAddress**: `string`

#### Description

User's Wallet Address

## Defined in

[src/methods/delta/getDeltaPrice.ts:6](https://github.com/paraswap/paraswap-sdk/blob/master/src/methods/delta/getDeltaPrice.ts#L6)
