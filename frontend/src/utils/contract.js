export const CONTRACT_ADDRESS = "0x104739765FD82261F7a5005Af47ec6412484081c";

export const CONTRACT_ABI = [
    "function createWager(uint256 matchId) external payable",
    "function joinWager(uint256 matchId) external payable",
    "function settle(uint256 matchId, address winner, bytes memory signature) external",
    "function cancelWager(uint256 matchId) external",
    "function wagers(uint256) view returns (address playerA, address playerB, uint256 stake, bool joined, bool settled, address winner)"
];
