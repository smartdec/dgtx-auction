var chai = require('chai');
var dirtyChai = require('dirty-chai');


const BigNumber = web3.BigNumber;

require('chai')
    .use(require('chai-as-promised'))
    .use(require('chai-bignumber')(BigNumber))
    .should();

import expectRevert from './helpers/expectRevert';

chai.use(dirtyChai);

const {expect} = chai;
const {assert} = chai;

var Token = artifacts.require("DGTX");
var Auction = artifacts.require("Auction");
var ContractBidder = artifacts.require("ContractBidder");

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


const mine = () => {
    return new Promise((resolve, reject) => {
        web3.currentProvider.sendAsync({
            jsonrpc: '2.0',
            method: 'evm_mine',
            params: [],
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
    let now;
    let startTimeFix;
    let maxBid;

    // Get block timestamp.
    beforeEach(async () => {
        now = web3.eth.getBlock(web3.eth.blockNumber).timestamp;
        startTimeFix = 60 * 60 ; // 1 hour
        maxBid = 1000000;
    });

    describe('construction', async () => {
        it("Check 0x0 token", async () => {
            await expectRevert(Auction.new("0x0", accounts[0], now + startTimeFix, maxBid, {from: accounts[0]}));
        });
        it("Check 0x0 beneficiary", async () => {
            await expectRevert(Auction.new(accounts[0], "0x0", now + startTimeFix, maxBid, {from: accounts[0]}));
        });
        it("Check startTime <= now", async () => {
            let token = await Token.new({from: accounts[0]});
            await expectRevert(Auction.new(token.address, accounts[0], now - 60 * 60, maxBid, {from: accounts[0]}));
        });
        it("Check maxBid = 0", async () => {
            let token = await Token.new({from: accounts[0]});
            await expectRevert(Auction.new(token.address, accounts[0], now + startTimeFix, 0, {from: accounts[0]}));
        });
        it("Check ownership transfer", async () => {
            let token = await Token.new({from: accounts[0]});
            let auction = await Auction.new(token.address, accounts[0], now + startTimeFix, maxBid, {from: accounts[0]});

            await auction.transferOwnership(accounts[1], {from: accounts[0]});
            assert.equal(await auction.owner(), accounts[1], "The ownership transferred incorrectly");
        });
        it("Checking initialized", async () => {
            let token = await Token.new({from: accounts[0]});
            let timeStart = now + startTimeFix;
            let timeEnd = timeStart + 60 * 60 *24 * 30;
            let auction = await Auction.new(token.address, accounts[0], timeStart, maxBid, {from: accounts[0]});
            expect(await (auction.centsReceived(accounts[0]))).to.be.zero();
            expect(await auction.token()).to.equal(token.address);
            expect(await auction.beneficiary()).to.equal(accounts[0]);
            expect(await auction.TOTAL_TOKENS()).to.be.bignumber.equal(web3.toWei(100000000));
            expect(await auction.DOLLAR_DECIMALS_MULTIPLIER()).to.be.bignumber.equal('100');
            expect(await auction.TOKEN_DECIMALS_MULTIPLIER()).to.be.bignumber.equal(web3.toWei(1));
            expect(await auction.START_PRICE_IN_CENTS()).to.be.bignumber.equal('25');
            expect(await auction.MIN_PRICE_IN_CENTS()).to.be.bignumber.equal('1');
            expect(await auction.TRANSACTION_MIN_IN_ETH()).to.be.bignumber.equal(web3.toWei(0.01));
            expect(await auction.START_ETH_TO_CENTS()).to.be.bignumber.equal('83800');
            expect(await auction.startTime()).to.be.bignumber.equal(new BigNumber(timeStart));
            expect(await auction.endTime()).to.be.bignumber.equal(new BigNumber(timeEnd));
            expect(await auction.maxBidInCentsPerAddress()).to.be.bignumber.equal(new BigNumber(maxBid));
            expect(await auction.ethToCents()).to.be.bignumber.equal('83800');
            expect(await auction.totalCentsCollected()).to.be.bignumber.equal('0');
            expect(await auction.hasEnded()).to.be.false();
            expect(await auction.tokensReceived()).to.be.false();
            expect(await auction.getPrice()).to.be.bignumber.equal('25');
        });
    });
    describe("Initial state", async () => {
        let token;
        let auction;
        beforeEach(async () => {
            token = await Token.new({from: accounts[0]});
            auction = await Auction.new(token.address, accounts[0], now + startTimeFix, maxBid, {from: accounts[0]});
        });
        context("Checking Tokensale accept tokens in initial state", async () => {

            it("Can't call not from token.", async () => {
                await expectRevert(auction.tokenFallback(accounts[0], web3.toWei(100000000), "", {from: accounts[0]}));
            });

            it("Can't transfer not 100 000 000 tokens.", async () => {
                await expectRevert(token.transfer(auction.address, web3.toWei(10), {from: accounts[0]}));
            });

            it("Can transfer tokens to auction in initial state.", async () => {
                await token.transfer(auction.address, web3.toWei(100000000), {from: accounts[0]});
                expect(await auction.tokensReceived()).to.be.true();
                expect(await token.balanceOf(auction.address)).to.be.bignumber.equal(web3.toWei(100000000));
            });

            it("Can't transfer tokens twice.", async () => {
                await token.transfer(auction.address, web3.toWei(100000000), {from: accounts[0]});
                await expectRevert(token.transfer(auction.address, web3.toWei(100000000), {from: accounts[0]}));
            });
            it("Can transfer not 100 000 000 tokens after the first transfer.", async () => {
                token.transfer(auction.address, web3.toWei(100000000), {from: accounts[0]});
                await expectRevert(token.transfer(auction.address, 1, {from: accounts[0]}));
            });
        });
        context("Checking one's restriction", async () => {
            beforeEach(async () => {
                await token.transfer(auction.address, web3.toWei(100000000), {from: accounts[0]});
            });
            it("Checking that one can't bid or withdraw before auction", async () => {
                await expectRevert(auction.sendTransaction({
                    from: accounts[1],
                    value: (web3.toWei(await auction.TRANSACTION_MIN))
                }));
            });
            it("Checking that one can't bid from contract", async () => {
                var bidder = await ContractBidder.new({from: accounts[0]});
                await increaseTime(60 * 60 * 24 * 3);
                await bidder.sendTransaction({
                        from: accounts[0],
                        value: (web3.toWei(1))
                    });
                await expectRevert(bidder.bid(auction.address, {from: accounts[1]}));
            });
        });
    });
    describe("Main stage", async () => {
        it("Checking owner can send ether and withdraw it", async () => {
            let token = await Token.new({from: accounts[0]});
            let auction = await Auction.new(token.address, accounts[0], now + startTimeFix, maxBid, {from: accounts[0]});

            await token.transfer(auction.address, web3.toWei(100000000), {from: accounts[0]});
            await increaseTime(60 * 60 * 24 * 5); //5 days

            var pBalance = await web3.eth.getBalance(accounts[0]);

            expect(await web3.eth.getBalance(auction.address)).to.be.bignumber.equal(web3.toWei(0), "Ethers 0");
            await auction.sendTransaction({from: accounts[0], value: (web3.toWei(1))});
            expect(await web3.eth.getBalance(auction.address)).to.be.bignumber.equal(web3.toWei(1), "Ethers received");

            await auction.withdraw(accounts[0], web3.toWei(0.3));
            await expectRevert(auction.withdraw(accounts[0], web3.toWei(0.3), {from: accounts[1]}));
            await expectRevert(auction.withdraw(accounts[0], web3.toWei(0), {from: accounts[0]}));
            await expectRevert(auction.withdraw("0x0", web3.toWei(0.3), {from: accounts[0]}));
            await expectRevert(auction.withdraw(accounts[0], web3.toWei(1.2)));
            expect(await web3.eth.getBalance(auction.address)).to.be.bignumber.equal(web3.toWei(0.7), "0.3 withdrawn");
            await expectRevert(auction.withdrawAll(accounts[0], {from: accounts[1]}));
            await auction.withdrawAll(accounts[0]);
            await expectRevert(auction.withdrawAll(accounts[0]));
            expect(await web3.eth.getBalance(auction.address)).to.be.bignumber.equal(web3.toWei(0), "All withdrawn");
        });
        it("Checking can't send less than transaction minimum", async () => {
            let token = await Token.new({from: accounts[0]});
            let auction = await Auction.new(token.address, accounts[0], now + startTimeFix, maxBid, {from: accounts[0]});

            await token.transfer(auction.address, web3.toWei(100000000), {from: accounts[0]});
            await increaseTime(60 * 60 * 24 * 3); //3 days

            await expectRevert(auction.sendTransaction({from: accounts[1], value: (web3.toWei(0.001))}));
        });
        it("Checking can't invest more than address maximum", async () => {
            let token = await Token.new({from: accounts[0]});
            let auction = await Auction.new(token.address, accounts[0], now + startTimeFix, maxBid, {from: accounts[0]});

            await token.transfer(auction.address, web3.toWei(100000000), {from: accounts[0]});
            await increaseTime(60 * 60 * 24 * 3); //3 days

            var bidCents1 = await auction.maxBidInCentsPerAddress() - 10000;
            var bidEth1 = bidCents1 * web3.toWei(1) / await auction.ethToCents();
            var bidCents2 = 20000;
            var bidEth2 = bidCents2 * web3.toWei(1) / await auction.ethToCents();

            await auction.sendTransaction({from: accounts[1], value: bidEth1});
            await auction.sendTransaction({from: accounts[1], value: bidEth2});

            assert.equal(await auction.centsReceived(accounts[1]).toString(), await auction.maxBidInCentsPerAddress().toString(), "Can invest more than address maximum");
        });
    });
    describe("Finising", async () => {
        it("Checking buying tokens and finish by user payment", async () => {
            let token = await Token.new({from: accounts[0]});
            let auction = await Auction.new(token.address, accounts[0], now + startTimeFix, 1000000000, {from: accounts[0]});

            await token.transfer(auction.address, web3.toWei(100000000), {from: accounts[0]});
            
            await increaseTime(60 * 60 * 6);
            await mine();
            expect(await auction.getPrice()).to.be.bignumber.equal(new BigNumber(20), "Price is 20");
            
            await auction.sendTransaction({from: accounts[1], value: web3.toWei(9546.539379474941)});
            expect(await auction.centsReceived(accounts[1])).to.be.bignumber.equal('800000000');
            expect(await auction.totalCentsCollected()).to.be.bignumber.equal('800000000');
            
            await increaseTime(60 * 60 * 10);
            await mine();
            expect(await auction.getPrice()).to.be.bignumber.equal(new BigNumber(10), "Price is 10");

            await auction.sendTransaction({from: accounts[2], value: web3.toWei(7150.904534606206)});
            expect(await auction.centsReceived(accounts[2])).to.be.bignumber.equal('200000000');
            expect(await auction.totalCentsCollected()).to.be.bignumber.equal('1000000000');
            
            expect(await auction.hasEnded()).to.be.true("Invalid state after finishing - hasEnded");
            expect(await auction.areTokensSold()).to.be.true("Invalid state after finishing - hasEnded");
            
            expect(await token.balanceOf(accounts[1])).to.be.bignumber.equal('0');
            expect(await token.balanceOf(accounts[2])).to.be.bignumber.equal('0');
        
            await auction.sendTransaction({from: accounts[1]});
            await expectRevert(auction.sendTransaction({from: accounts[3]}));

            expect(await token.balanceOf(accounts[1])).to.be.bignumber.equal(web3.toWei(80000000));
            expect(await token.balanceOf(accounts[2])).to.be.bignumber.equal('0');

            await auction.sendTransaction({from: accounts[2]});

            expect(await token.balanceOf(accounts[1])).to.be.bignumber.equal(web3.toWei(80000000));
            expect(await token.balanceOf(accounts[2])).to.be.bignumber.equal(web3.toWei(20000000));

            await expectRevert(auction.sendTransaction({from: accounts[2]}));
            await expectRevert(auction.sendTransaction({from: accounts[1]}));
        });
        it("Checking buying tokens and finish by user payment", async () => {
            let token = await Token.new({from: accounts[0]});
            let auction = await Auction.new(token.address, accounts[0], now + startTimeFix, 1000000000, {from: accounts[0]});

            await token.transfer(auction.address, web3.toWei(100000000), {from: accounts[0]});
            
            await increaseTime(60 * 60 * 6);
            await mine();
            expect(await auction.getPrice()).to.be.bignumber.equal(new BigNumber(20), "Price is 20");
            
            await auction.sendTransaction({from: accounts[1], value: web3.toWei(9546.539379474941)});
            expect(await auction.centsReceived(accounts[1])).to.be.bignumber.equal('800000000');
            expect(await auction.totalCentsCollected()).to.be.bignumber.equal('800000000');
            
            await increaseTime(60 * 60 * 10);
            await mine();
            expect(await auction.getPrice()).to.be.bignumber.equal(new BigNumber(10), "Price is 10");

            await expectRevert(auction.distributeTokensRange(0, 2));

            await auction.sendTransaction({from: accounts[2], value: web3.toWei(7150.904534606206)});
            expect(await auction.centsReceived(accounts[2])).to.be.bignumber.equal('200000000');
            expect(await auction.totalCentsCollected()).to.be.bignumber.equal('1000000000');
            
            expect(await auction.hasEnded()).to.be.true("Invalid state after finishing - hasEnded");
            expect(await auction.areTokensSold()).to.be.true("Invalid state after finishing - hasEnded");
            
            expect(await token.balanceOf(accounts[1])).to.be.bignumber.equal('0');
            expect(await token.balanceOf(accounts[2])).to.be.bignumber.equal('0');

            await expectRevert(auction.distributeTokensRange(1, 0));
            await expectRevert(auction.distributeTokensRange(0, 3));
            await auction.distributeTokensRange(0, 2);
        
            expect(await token.balanceOf(accounts[1])).to.be.bignumber.equal(web3.toWei(80000000));
            expect(await token.balanceOf(accounts[2])).to.be.bignumber.equal(web3.toWei(20000000));

            await auction.distributeTokensRange(0, 1);

            expect(await token.balanceOf(accounts[1])).to.be.bignumber.equal(web3.toWei(80000000));
            expect(await token.balanceOf(accounts[2])).to.be.bignumber.equal(web3.toWei(20000000));

        });
        it("Checking buying tokens and finish by price decrease", async () => {
            let token = await Token.new({from: accounts[0]});
            let auction = await Auction.new(token.address, accounts[0], now + startTimeFix, 1000000000000, {from: accounts[0]});

            await token.transfer(auction.address, web3.toWei(100000000), {from: accounts[0]});
            await increaseTime(60 * 60 * 6); 
            await mine();

            expect(await auction.getPrice()).to.be.bignumber.equal(new BigNumber(20), "Price is not 20");
            await increaseTime(60 * 30);
            await mine();
            expect(await auction.getPrice()).to.be.bignumber.equal(new BigNumber(20), "Price is not 20");

            await auction.sendTransaction({from: accounts[1], value: web3.toWei(23866.34844868735)});
            expect(await auction.areTokensSold()).to.be.false("Not sold yet");
            expect(await auction.centsReceived(accounts[1])).to.be.bignumber.equal(new BigNumber(1999999999));

            await increaseTime(60 * 45);
            await mine();
            expect(await auction.getPrice()).to.be.bignumber.equal(new BigNumber(19), "Price is not 19");
            expect(await auction.areTokensSold()).to.be.true("Already sold");
        });
        it("Checking finishing auction by time", async () => {
            let token = await Token.new({from: accounts[0]});
            let auction = await Auction.new(token.address, accounts[0], now + startTimeFix, maxBid, {from: accounts[0]});
            await token.transfer(auction.address, web3.toWei(100000000), {from: accounts[0]});

            await increaseTime(60 * 60 * 6);
            await mine();

            await expectRevert(auction.withdrawExtraTokens(accounts[2], {from: accounts[0]}));
            
            await auction.sendTransaction({from: accounts[1], value: web3.toWei(119.3317422434)});
            expect(await auction.centsReceived(accounts[1])).to.be.bignumber.equal('1000000', "cents recieved");
            expect(await auction.totalCentsCollected()).to.be.bignumber.equal('1000000', "total cents received");
            

            await increaseTime(60 * 60 * 24 * 40);
            await mine();

            expect(await auction.hasEnded()).to.be.true("Invalid state after finishing - hasEnded");
            expect(await auction.areTokensSold()).to.be.false("Invalid state after finishing - areTokensSold");

            await expectRevert(auction.withdrawExtraTokens(accounts[1], {from: accounts[1]}));
            await auction.withdrawExtraTokens(accounts[2], {from: accounts[0]});

            await auction.sendTransaction({from: accounts[1]});

            expect(await token.balanceOf(accounts[2])).to.be.bignumber.equal(web3.toWei(99000000), "Invalid amount of withdrawn extra tokens");
            expect(await token.balanceOf(accounts[1])).to.be.bignumber.equal(web3.toWei(1000000));
        });
    });
});