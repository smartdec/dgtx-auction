# Digitex Dutch auction contract

Implementation of the Dutch auction for 100,000,000 DGTX.

## Dutch auction

1. Token auction will start at 9am EST on February 15th, 2018.
2. The price starts from $0.25 and linearly decreases by $0.01 every hour until it reaches $0.01.
3. The auction lasts no more than 30 days.
4. Public can participate in auction by sending ETH to the auction contract.
5. Buyer’s bid is calculated in USD according to the ETH/USD exchange rate in the contract at the time the funds are received.
6. Contributions are limited: maximum - $10000 per address, minimum - 0.01 ETH per transaction.
7. The ETH/USD rate is updated every hour using an oracle.
8. Auction is finished when amount of USD received is equal to the current valuation of the tokens offered (that is current auction token price multiplied by total amount of tokens offered).
9. After auction is finished buyers can claim tokens according to the final auction price and the size of their bid. Each buyer receives the portion of all tokens offered proportional to their bid (calculated in USD at the moment the funds are sent as described above). This way each buyer receives tokens according to the final price at the moment of the end of auction. Each buyer is guaranteed to receive tokens at a price no higher than the price at which they bid.

Note that at the end of auction the market price of ETH collected may (and will) be different from the sum of all bids that is used in calculating the final auction price.

## Implementing the distribution of assets

1. When a buyer sends transactions with or without ETH to the contract after auction is finished, the contract will refund tokens to the buyer according to the final auction price. 
2. ETH collected in bids is sent to the address(es) provided by the owner immediately.
3. After the auction is over the owner can trigger the function that sends tokens to buyers. This will be done in portions to avoid out-of-gas and ERC223 compatibility issues.

## Auction finalization

The auction can be finished in several ways:
1. After a particular buyer sends ETH the target sum is collected. If the buyer sends more than needed to reach target sum, their extra ETH is refunded.
2. After a step of price decrease the target sum is collected. However the equilibrium price will probably lay between the two steps of the price. For example, when the price is 0.5$ the target sum isn’t collected, but when price shifts to 0.49$ more than the target sum is collected, and on price 0.497$ equilibrium is reached. In this case, the intermediate value will be used by the contract as the final price.
3. 30 days have passed and less than $1MM is collected. Buyers get tokens at the price of $0.01 and some tokens remain unsold (the owner gets them back).

## Lifecycle of the contract
1. The owner deploys the contract.
2. The owner calls updateEthToCentsRate function.
3. The owner transfers 100,000,000 DGTX to the contract.
4. Auction starts.
5. Buyers send ETH to the contract. ETH is stored in the account provided by the owner.
6. Auction ends in one of the ways described and the final token price is calculated.
7. After auction is finished if a buyer sends a transactions to the contract they claim tokens the contract owes them according to the final auction price and their bid.
8. After the auction the owner can also trigger transfer of tokens to buyers.

## Notes

Due to rounding issues small quantity of tokens (less than 1 DGTX) may be stuck in the contract forever.

## Build

```bash
npm install
npm run truffle compile
```

## Deploy
To deploy contracts to Ethereum network

Edit `truffle-config.js` for proper network, like:
```js
module.exports = {
  networks: {
    ropsten:  {
      network_id: 3,
      host: "localhost",
      port:  8546,
      gas:   4600000,
      gasPrice: 5000000000
    }
    ...
```

And run
```bash
npm run truffle migrate
```

One must call updateEthToCentsRate function to launch rate update cycle.

## Test (Unix only)
To run test run
```bash
npm run test
```

## Coverage (Unix only)
To run test coverage run

```bash
npm run coverage
```


## Addtional notes
Folder `test/DGTX` is DGTX token source code from [repo](https://github.com/DigitexFutures/DigitexTokens).
