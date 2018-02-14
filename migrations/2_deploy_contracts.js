var Auction = artifacts.require("./Auction.sol");

module.exports = function(deployer) {
	// start time is 9am EST on February 15th, 2018
	deployer.deploy(Auction, "0x1c83501478f1320977047008496dacbd60bb15ef", "0xF728dE7538bDF09D60c3A32b90673335d0Ee9eCc", 1518703200, 1000000, {value: web3.toWei(0.5)});
};
