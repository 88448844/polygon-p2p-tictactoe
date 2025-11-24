require('dotenv').config();
const { ethers } = require('ethers');

const CONTRACT_ADDRESS = "0x104739765FD82261F7a5005Af47ec6412484081c";
const ABI = ["function trustedSigner() view returns (address)"];

async function check() {
    const provider = new ethers.JsonRpcProvider("https://polygon-rpc.com");
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

    try {
        console.log("Querying contract...");
        const onChainSigner = await contract.trustedSigner();
        console.log("✅ Contract Trusted Signer:", onChainSigner);

        if (process.env.PRIVATE_KEY) {
            const wallet = new ethers.Wallet(process.env.PRIVATE_KEY);
            console.log("🔑 Backend Private Key Address:", wallet.address);

            if (onChainSigner.toLowerCase() === wallet.address.toLowerCase()) {
                console.log("🎉 MATCH! The Private Key is correct.");
            } else {
                console.error("❌ MISMATCH! The Private Key in .env does NOT belong to the trustedSigner.");
                console.error("Please find the Private Key for:", onChainSigner);
            }
        } else {
            console.log("⚠️ No PRIVATE_KEY found in .env");
        }

    } catch (err) {
        console.error("Error querying contract:", err.message);
        console.log("Note: If 'trustedSigner' is not a public variable, this will fail.");
    }
}

check();
