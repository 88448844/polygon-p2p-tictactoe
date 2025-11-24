import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import confetti from 'canvas-confetti';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from './utils/contract';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || window.location.origin;

function App() {
  const [account, setAccount] = useState(null);
  const [matchId, setMatchId] = useState('');
  const [betAmount, setBetAmount] = useState('0.01');
  const [usdValue, setUsdValue] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // Auto-connect wallet on load
  useEffect(() => {
    const autoConnect = async () => {
      if (window.ethereum) {
        try {
          const provider = new ethers.BrowserProvider(window.ethereum);
          const accounts = await provider.listAccounts();
          if (accounts.length > 0) {
            const signer = await provider.getSigner();
            setAccount((await signer.getAddress()).toLowerCase());
          }
        } catch (e) {
          // User hasn't connected yet, that's fine
        }
      }
    };
    autoConnect();
  }, []);

  // Real-time USD price (updates every 30s)
  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=matic-network&vs_currencies=usd');
        const data = await res.json();
        const price = data['matic-network']?.usd;
        if (price && betAmount) {
          setUsdValue((parseFloat(betAmount) * price).toFixed(2));
        }
      } catch (e) {
        setUsdValue(null);
      }
    };
    fetchPrice();
    const interval = setInterval(fetchPrice, 30000); // Update every 30s
    return () => clearInterval(interval);
  }, [betAmount]);

  // Poll Game State
  useEffect(() => {
    if (!matchId) return;
    const interval = setInterval(fetchGameState, 2000);
    return () => clearInterval(interval);
  }, [matchId]);

  // Confetti on win
  useEffect(() => {
    if (gameState?.status === 'COMPLETED' && gameState?.winner === account) {
      // Trigger dramatic confetti
      const duration = 3000;
      const end = Date.now() + duration;

      const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444'];

      (function frame() {
        confetti({
          particleCount: 4,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: colors
        });
        confetti({
          particleCount: 4,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: colors
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      })();
    }
  }, [gameState?.status, gameState?.winner, account]);

  // Toast auto-dismiss
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
  };

  const fetchGameState = async () => {
    try {
      const res = await fetch(`${API_URL}/gameState/${matchId}`);
      if (res.ok) {
        const prevBoard = gameState?.board;
        const data = await res.json();

        // Detect board reset (draw scenario)
        if (prevBoard && !prevBoard.includes(null) &&
          data.board && data.board.every(cell => cell === null)) {
          showToast("Draw! Board reset - keep playing!", "info");
        }

        setGameState(data);
      }
    } catch (e) { /* ignore errors while polling */ }
  };

  const connectWallet = async () => {
    if (!window.ethereum) {
      showToast("Please install MetaMask!", "error");
      return;
    }
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      setAccount((await signer.getAddress()).toLowerCase());
      showToast("Wallet connected!", "success");
    } catch (e) {
      showToast("Connection failed", "error");
    }
  };

  const getContract = async () => {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
  };

  const copyMatchId = () => {
    navigator.clipboard.writeText(matchId);
    showToast("Match ID copied!", "success");
  };

  // 1. Create Game
  const createGame = async () => {
    if (!betAmount || parseFloat(betAmount) <= 0) {
      showToast("Enter a valid amount", "error");
      return;
    }
    setLoading(true);
    try {
      // A. Create on Backend
      const res = await fetch(`${API_URL}/createGame`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerA: account })
      });
      const data = await res.json();
      const newMatchId = data.matchId;
      setMatchId(newMatchId);

      // B. Create on Blockchain
      const contract = await getContract();
      const tx = await contract.createWager(newMatchId, { value: ethers.parseEther(betAmount) });
      await tx.wait();

      showToast(`Game created! Match ID: ${newMatchId}`, "success");
    } catch (err) {
      console.error(err);
      showToast(err.message || "Failed to create game", "error");
      setMatchId('');
    }
    setLoading(false);
  };

  // 2. Join Game
  const joinGame = async () => {
    if (!matchId || matchId.length !== 6) {
      showToast("Enter a valid 6-digit Match ID", "error");
      return;
    }
    setLoading(true);
    try {
      // A. Join on Blockchain
      const contract = await getContract();
      const tx = await contract.joinWager(matchId, { value: ethers.parseEther(betAmount) });
      await tx.wait();

      // B. Join on Backend
      await fetch(`${API_URL}/joinGame`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, playerB: account })
      });

      showToast("Joined! Game starting...", "success");
      fetchGameState();
    } catch (err) {
      console.error(err);
      showToast(err.message || "Failed to join", "error");
    }
    setLoading(false);
  };

  // 3. Play Move
  const makeMove = async (index) => {
    if (!gameState || gameState.turn !== account) return;
    try {
      await fetch(`${API_URL}/makeMove`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, player: account, index })
      });
      fetchGameState();
    } catch (err) {
      console.error(err);
    }
  };

  // 4. Claim Prize
  const claimPrize = async () => {
    if (!gameState || !gameState.signature) return;
    setLoading(true);
    try {
      const contract = await getContract();
      const tx = await contract.settle(matchId, account, gameState.signature);
      await tx.wait();
      showToast("Prize claimed! 💰", "success");
    } catch (err) {
      console.error(err);
      showToast(err.message || "Claim failed", "error");
    }
    setLoading(false);
  };

  // RENDER HELPERS
  const isPlayerA = gameState?.playerA === account;
  const isPlayerB = gameState?.playerB === account;
  const mySymbol = isPlayerA ? 'X' : (isPlayerB ? 'O' : '?');
  const turnMsg = gameState?.turn === account ? "YOUR TURN" : "Waiting for opponent...";

  return (
    <div className="container">
      {/* Toast Notification */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.message}
        </div>
      )}

      <header>
        <h1>❌ Tic-Tac-Toe Wager ⭕</h1>
        {!account ? (
          <button onClick={connectWallet} className="connect-btn">Connect Wallet</button>
        ) : (
          <div className="wallet-info">
            <span>{account.slice(0, 6)}...{account.slice(-4)}</span>
          </div>
        )}
      </header>

      <main>
        {/* LOBBY */}
        {!gameState && (
          <div className="card">
            <h2>Start or Join</h2>
            <div className="input-group">
              <label>Bet Amount</label>
              <input
                type="number"
                value={betAmount}
                onChange={e => setBetAmount(e.target.value)}
                step="0.01"
                placeholder="0.01"
              />
              {usdValue && (
                <div className="price-display">
                  <span className="price-label">USD Value</span>
                  <span className="price-value">${usdValue}</span>
                </div>
              )}
            </div>

            <div className="lobby-actions">
              <div className="action-section">
                <h3>Create New Game</h3>
                <button onClick={createGame} disabled={!account || loading} className="btn-primary">
                  {loading ? 'Creating...' : 'Create & Pay'}
                </button>
              </div>
              <div className="divider">OR</div>
              <div className="action-section">
                <h3>Join Existing Game</h3>
                <input
                  type="text"
                  placeholder="Enter 6-digit ID"
                  value={matchId}
                  onChange={e => setMatchId(e.target.value)}
                  maxLength={6}
                />
                <button onClick={joinGame} disabled={!account || !matchId || loading} className="btn-secondary">
                  {loading ? 'Joining...' : 'Join & Pay'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* WAITING SCREEN */}
        {gameState && gameState.status === 'WAITING' && (
          <div className="card waiting-card">
            <h2>Waiting for Opponent...</h2>
            <div className="match-id-display">
              <p className="match-id">{matchId}</p>
              <button onClick={copyMatchId} className="btn-copy">📋 Copy ID</button>
            </div>
            <p className="share-hint">Share this ID with your opponent</p>
            <div className="spinner"></div>
          </div>
        )}

        {/* GAME BOARD */}
        {gameState && (gameState.status === 'PLAYING' || gameState.status === 'COMPLETED') && (
          <div className="game-container">
            <div className="status-bar">
              <p>You are: <strong>{mySymbol}</strong></p>
              {gameState.status === 'PLAYING' && <p className="turn-indicator">{turnMsg}</p>}
              {gameState.status === 'COMPLETED' && (
                <p className="game-over">
                  {gameState.winner === 'DRAW' ? "It's a DRAW!" :
                    (gameState.winner === account ? "🎉 YOU WON! 🎉" : "You Lost 😢")}
                </p>
              )}
            </div>

            <div className="board">
              {gameState.board.map((cell, i) => (
                <button
                  key={i}
                  className={`cell ${cell ? cell : ''}`}
                  onClick={() => makeMove(i)}
                  disabled={!!cell || gameState.turn !== account || gameState.status !== 'PLAYING'}
                >
                  {cell}
                </button>
              ))}
            </div>

            {/* CLAIM BUTTON */}
            {gameState.status === 'COMPLETED' && gameState.winner === account && (
              <div className="claim-section">
                <button onClick={claimPrize} disabled={loading} className="btn-success">
                  {loading ? 'Claiming...' : '💰 CLAIM PRIZE 💰'}
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
