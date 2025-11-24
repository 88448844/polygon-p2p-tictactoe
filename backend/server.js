require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { ethers } = require('ethers');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'public')));
}

const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------
// IN-MEMORY DATABASE
// ---------------------------------------------------------
// Key: matchId (string)
// Value: {
//   matchId: string,
//   playerA: string (address),
//   playerB: string (address),
//   board: Array(9).fill(null), // Indices 0-8
//   turn: string (address of current player),
//   winner: string (address) | 'DRAW' | null,
//   status: 'WAITING' | 'PLAYING' | 'COMPLETED',
//   signature: string | null
// }
const gamesDb = new Map();

// Load Private Key
let PRIVATE_KEY = process.env.PRIVATE_KEY;
if (!PRIVATE_KEY) {
    console.error("ERROR: PRIVATE_KEY not set in .env");
    process.exit(1);
}

// Sanitize: remove whitespace/newlines
PRIVATE_KEY = PRIVATE_KEY.trim();

// Debug logging (safe)
console.log(`[DEBUG] Key Length: ${PRIVATE_KEY.length}`);
console.log(`[DEBUG] Key Start: ${PRIVATE_KEY.substring(0, 4)}...`);
console.log(`[DEBUG] Key End: ...${PRIVATE_KEY.substring(PRIVATE_KEY.length - 4)}`);

if (!PRIVATE_KEY.startsWith('0x')) {
    console.log("[DEBUG] Appending '0x' prefix");
    PRIVATE_KEY = '0x' + PRIVATE_KEY;
}

let SIGNER_WALLET;
try {
    SIGNER_WALLET = new ethers.Wallet(PRIVATE_KEY);
    console.log(`[SUCCESS] Wallet loaded: ${SIGNER_WALLET.address}`);
} catch (error) {
    console.error("[FATAL] Failed to create wallet:", error.message);
    process.exit(1);
}

// ---------------------------------------------------------
// HELPER FUNCTIONS
// ---------------------------------------------------------
const checkWin = (board) => {
    const lines = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // Cols
        [0, 4, 8], [2, 4, 6]             // Diagonals
    ];
    for (let i = 0; i < lines.length; i++) {
        const [a, b, c] = lines[i];
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a]; // 'X' or 'O'
        }
    }
    return null;
};

// ---------------------------------------------------------
// API ENDPOINTS
// ---------------------------------------------------------

// 1. Create Game (Player A)
app.post('/createGame', (req, res) => {
    const { playerA } = req.body;
    // Generate a random 6-digit ID
    const matchId = Math.floor(100000 + Math.random() * 900000).toString();

    gamesDb.set(matchId, {
        matchId,
        playerA: playerA.toLowerCase(),
        playerB: null,
        board: Array(9).fill(null),
        turn: playerA.toLowerCase(), // Player A starts
        winner: null,
        status: 'WAITING',
        signature: null
    });

    console.log(`[GAME] Created ${matchId} by ${playerA}`);
    res.json({ success: true, matchId });
});

// 2. Join Game (Player B)
app.post('/joinGame', (req, res) => {
    const { matchId, playerB } = req.body;
    const game = gamesDb.get(matchId);

    if (!game) return res.status(404).json({ error: "Game not found" });
    if (game.playerB) return res.status(400).json({ error: "Game full" });
    if (game.playerA === playerB.toLowerCase()) return res.status(400).json({ error: "Cannot play against yourself" });

    game.playerB = playerB.toLowerCase();
    game.status = 'PLAYING';

    console.log(`[GAME] ${playerB} joined ${matchId}`);
    res.json({ success: true });
});

// 3. Make Move
app.post('/makeMove', async (req, res) => {
    const { matchId, player, index } = req.body;
    const game = gamesDb.get(matchId);

    if (!game) return res.status(404).json({ error: "Game not found" });
    if (game.status !== 'PLAYING') return res.status(400).json({ error: "Game not active" });
    if (game.turn !== player.toLowerCase()) return res.status(400).json({ error: "Not your turn" });
    if (game.board[index]) return res.status(400).json({ error: "Cell taken" });

    // Update Board
    const symbol = (player.toLowerCase() === game.playerA) ? 'X' : 'O';
    game.board[index] = symbol;

    // Check Win
    const winnerSymbol = checkWin(game.board);
    if (winnerSymbol) {
        game.status = 'COMPLETED';
        game.winner = (winnerSymbol === 'X') ? game.playerA : game.playerB;
        console.log(`[GAME] ${matchId} WON by ${game.winner}`);

        // AUTO-SIGN
        try {
            const chainId = 137;
            const messageHash = ethers.solidityPackedKeccak256(
                ['uint256', 'uint256', 'address'],
                [chainId, matchId, game.winner]
            );
            game.signature = await SIGNER_WALLET.signMessage(ethers.getBytes(messageHash));
        } catch (e) {
            console.error("Signing failed", e);
        }

    } else if (!game.board.includes(null)) {
        // DRAW - Reset board and continue playing
        console.log(`[GAME] ${matchId} DRAW - Resetting board for next round`);
        game.board = Array(9).fill(null);
        // Keep same turn player (fairness - they go first in new round)
        // Or alternate if you prefer: game.turn = (game.turn === game.playerA) ? game.playerB : game.playerA;
    } else {
        // Switch Turn
        game.turn = (game.turn === game.playerA) ? game.playerB : game.playerA;
    }

    res.json({ success: true, game });
});

// 4. Get Game State (Polling)
app.get('/gameState/:matchId', (req, res) => {
    const game = gamesDb.get(req.params.matchId);
    if (!game) return res.status(404).json({ error: "Not found" });
    res.json(game);
});

// Serve index.html for all other routes (SPA support)
if (process.env.NODE_ENV === 'production') {
    // Serve index.html for any unmatched route (SPA support)
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });
}

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Signer: ${SIGNER_WALLET ? SIGNER_WALLET.address : 'None'}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
