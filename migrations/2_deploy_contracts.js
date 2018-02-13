var Auction = artifacts.require("./Auction.sol");

module.exports = function(deployer) {
	deployer.deploy(Auction, "0x1c83501478f1320977047008496dacbd60bb15ef", "0xF728dE7538bDF09D60c3A32b90673335d0Ee9eCc", {value: web3.toWei(0.5)});
};
