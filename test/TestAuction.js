import chai from 'chai';
import dirtyChai from 'dirty-chai';
import BigNumber from 'bignumber.js';

chai.use(dirtyChai);

const { expect } = chai;
const { assert } = chai;

var Token = artifacts.require("DGTX");
var Auction = artifacts.require("Auction");
var AuctionUnlimited = artifacts.require("AuctionMaxUnlimited");

const increaseTime = (time) => {
  return new Promise((resolve, reject) => {
    web3.currentProvider.sendAsync({
      jsonrpc: '2.0',
      method: 'evm_increaseTime',
      params: [time], // Time increase param.
      id: new Date().getTime(),
    }, (err) => {
      if (err) {
        return reject(err);
      }

      return resolve();
    });
  });
};

contract("Auction", function (accounts) {
    it ("Check ownership transfer", async function () {
        let token = await Token.new({from: accounts[0]});
        let auction = await Auction.new(token.address, accounts[0], {from: accounts[0]});

        await auction.transferOwnership(accounts[1], {from:accounts[0]});
        assert.equal(await auction.owner(), accounts[1], "The ownership transferred incorrectly");
    });
    it("Checking has getter for bids", async function () {
        let token = await Token.new({from: accounts[0]});
        let auction = await Auction.new(token.address, accounts[0], {from: accounts[0]});
        try {
            await auction.centsReceived(accounts[0]);
        } catch (e) {
            throw new Error("Tokensale doesn't have getter for investments");
        }

    }); 
    it("Checking Tokensale accept tokens in initial state", async function () {
        let token = await Token.new({from: accounts[0]});
        let auction = await Auction.new(token.address, accounts[0], {from: accounts[0]});

        var success = false;
        
        try{
            await auction.tokenFallback(accounts[0], web3.toWei(100000000), "", {from: accounts[0]});
            success = true;
        } catch(e) {
        }
        if (success) throw new Error("Can call not from token.")

        try{
            await token.transfer(auction.address, web3.toWei(10), {from: accounts[0]});
            success = true;
        } catch(e) {
        }
        if (success) throw new Error("Can tranfer not 100 000 000 tokens.")

        try{
            await token.transfer(auction.address, web3.toWei(100000000), {from: accounts[0]});
        } catch(e) {
            throw new Error("Can't transfer tokens to auction in initial state.");
        }

        try{
            await token.transfer(auction.address, web3.toWei(100000000), {from: accounts[0]});
            success = true;
        } catch(e) {
        }
        if (success) throw new Error("Can tranfer tokens twice.")

        try {
            await token.transfer(auction.address, 1, {from: accounts[0]});
            success = true;
        } catch(e) {}
        if (success) throw new Error("Can tranfer not 100 000 000 tokens after the first transfer.");
    });
    it("Checking that one can't bid or withdraw before auction'", async function () {
        let token = await Token.new({from: accounts[0]});
        let auction = await Auction.new(token.address, accounts[0], {from: accounts[0]});

        await token.transfer(auction.address, web3.toWei(100000000), {from: accounts[0]});
        
        var success = false;
        try {
            await auction.sendTransaction({from: accounts[1], value: (await web3.toWei(auction.TRANSACTION_MIN()))});
            sucess = true;
        } catch (e) {}
        if (success) throw new Error("Can bid or withdraw before auction.");

    });
    it("Checking can't send less than transaction minimum", async function() {
        let token = await Token.new({from: accounts[0]});
        let auction = await Auction.new(token.address, accounts[0], {from: accounts[0]});

        await token.transfer(auction.address, web3.toWei(100000000), {from: accounts[0]});

        await increaseTime(60 * 60 * 24 * 5); //5 days

        var success = false;
        try {
            await auction.sendTransaction({from: accounts[1], value: (await web3.toWei(0.001))});
            success = true;
        } catch (e) {}

        if (success) throw new Error("Can bid less than transaction minimum");
    });
    it("Checking can't invest more than address maximum", async function() {
        let token = await Token.new({from: accounts[0]});
        let auction = await Auction.new(token.address, accounts[0], {from: accounts[0]});

        await token.transfer(auction.address, web3.toWei(100000000), {from: accounts[0]});

        var bidCents1 = await auction.ADDRESS_MAX_BID_IN_CENTS() - 10000;
        var bidEth1 = bidCents1 * web3.toWei(1) / await auction.ethToCents();
        var bidCents2 = 20000;
        var bidEth2 = bidCents2 * web3.toWei(1) / await auction.ethToCents();
        var success = false;
        await auction.sendTransaction({from: accounts[1], value: bidEth1});
        await auction.sendTransaction({from: accounts[1], value: bidEth2});

        assert.equal(await auction.centsReceived(accounts[1]).toString(), await auction.ADDRESS_MAX_BID_IN_CENTS().toString(), "Can invest more than address maximum");
    });
    it("Checking buying tokens and finish by user payment", async function () {
        let token = await Token.new({from: accounts[0]});
        let auction = await AuctionUnlimited.new(token.address, accounts[0], {from: accounts[0]});

        await token.transfer(auction.address, web3.toWei(100000000), {from: accounts[0]});

        var bidCents = new BigNumber(await auction.getPrice()).multipliedBy(await auction.totalTokens());
        var bidEth = bidCents.dividedBy(await auction.ethToCents());
        await auction.sendTransaction({from: accounts[1], value: 1194317422434367541766});
        assert.equal(await auction.hasEnded(), true, "Invalid state after finishing");
        assert.equal(await auction.areTokensSold(), true, "Invalid state after finishing");
        await auction.sendTransaction({from: accounts[1]});
        //Not all tokens are withdrawn to invester
        expect(await token.balanceOf(accounts[1])).to.be.bignumber.equal(await auction.totalTokens());
    });
    it("Checking buying tokens and finish by price decrease", async function () {
        let token = await Token.new({from: accounts[0]});
        let auction = await Auction.new(token.address, accounts[0], {from: accounts[0]});

        await token.transfer(auction.address, web3.toWei(100000000), {from: accounts[0]});

        var bidCents = (await auction.getPrice() - 1) * await auction.totalTokens();
        var bidEth = bidCents / await auction.ethToCents();
        
        await auction.sendTransaction({from: accounts[1], value: bidEth});
        
        increaseTime(3600 * 2);
        assert.equal(await auction.hasEnded(), true, "Invalid state after finishing");
        assert.equal(await auction.areTokensSold(), true, "Invalid state after finishing");
        await auction.distributeTokensRange(0, 5);
        assert.equal(await token.balanceOf(accounts[1]), await auction.totalTokens(), "Not all tokens are withdrawn to invester");

        var success = false;
        try {
            await auction.sendTransaction({from: accounts[1]});
            success = true;
        } catch (e) {}

        if (success) throw new Error("Double withdrawn of tokens is allowed.")
    });
    it("Checking finishing auction by time", async function () {
        let token = await Token.new({from: accounts[0]});
        let auction = await Auction.new(token.address, accounts[0], {from: accounts[0]});

        await token.transfer(auction.address, web3.toWei(100000000), {from: accounts[0]});

        increaseTime(60 * 60 * 24 * 30);

        assert.equal(await auction.hasEnded(), true, "Invalid state after finishing");
        assert.equal(await auction.areTokensSold(), true, "Invalid state after finishing");
        await auction.withdrawExtraTokens(accounts[1]);
        assert.equal(await token.balanceOf(accounts[1]), web3.toWei(100000000), "Invalid amount of withdrawn extra tokens");
    });
})