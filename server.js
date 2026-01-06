const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Firebase Admin SDK
try {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com`
  });
} catch (err) {
  console.error('Firebase initialization error:', err.message);
  // If Firebase fails, the app will still run (but user features will be disabled)
}

const db = admin.firestore();

// ======================
// PUBLIC: DApp config (no auth needed)
// ======================
app.get('/api/config', (req, res) => {
  res.json({
    enabled: true,
    maintenance: false,
    supportedChains: [1, 137, 56, 8453, 42161, 10, 43114, 250],
    tokens: {
      1: [
        { symbol: "ETH", address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", decimals: 18 },
        { symbol: "USDC", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6 }
      ],
      137: [
        { symbol: "MATIC", address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", decimals: 18 },
        { symbol: "USDC", address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", decimals: 6 }
      ],
      56: [
        { symbol: "BNB", address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", decimals: 18 },
        { symbol: "USDC", address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", decimals: 6 }
      ],
      8453: [
        { symbol: "ETH", address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", decimals: 18 },
        { symbol: "USDC", address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6 }
      ],
      42161: [
        { symbol: "ETH", address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", decimals: 18 },
        { symbol: "USDC", address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", decimals: 6 }
      ],
      10: [
        { symbol: "ETH", address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", decimals: 18 },
        { symbol: "USDC", address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", decimals: 6 }
      ],
      43114: [
        { symbol: "AVAX", address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", decimals: 18 },
        { symbol: "USDC", address: "0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664", decimals: 6 }
      ],
      250: [
        { symbol: "FTM", address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", decimals: 18 }
      ]
    },
    defaultSlippage: 0.5,
    announcements: ["Welcome to your Web3 trading platform!"]
  });
});

// ======================
// PUBLIC: Get user data (credit points, assets, withdraw permission)
// ======================
app.get('/api/user/:wallet', async (req, res) => {
  try {
    const wallet = req.params.wallet.toLowerCase();
    if (!wallet.startsWith('0x') || wallet.length !== 42) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }

    const userDoc = await db.collection('users').doc(wallet).get();
    if (!userDoc.exists) {
      return res.json({
        creditPoints: 0,
        allowWithdraw: true,
        assets: {}
      });
    }

    const data = userDoc.data();
    res.json({
      creditPoints: data.creditPoints || 0,
      allowWithdraw: data.allowWithdraw !== false,
      assets: data.assets || {}
    });
  } catch (err) {
    console.error('User fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch user data' });
  }
});

// ======================
// PUBLIC: Check if user can withdraw
// ======================
app.get('/api/withdraw-allowed/:wallet', async (req, res) => {
  try {
    const wallet = req.params.wallet.toLowerCase();
    if (!wallet.startsWith('0x') || wallet.length !== 42) {
      return res.json({ allowed: false });
    }

    // Check per-user override
    const userDoc = await db.collection('users').doc(wallet).get();
    if (userDoc.exists && userDoc.data().allowWithdraw === false) {
      return res.json({ allowed: false });
    }

    // Check global setting
    const configDoc = await db.collection('config').doc('platform').get();
    const globalAllowed = configDoc.exists 
      ? configDoc.data().allowWithdrawGlobally !== false 
      : true;

    res.json({ allowed: globalAllowed });
  } catch (err) {
    console.error('Withdraw check error:', err);
    res.status(500).json({ allowed: false });
  }
});

// ======================
// PUBLIC: Register user on first visit (optional)
// ======================
app.post('/api/register', async (req, res) => {
  try {
    const { wallet } = req.body;
    if (!wallet || !wallet.startsWith('0x') || wallet.length !== 42) {
      return res.status(400).json({ error: 'Invalid wallet' });
    }

    const userRef = db.collection('users').doc(wallet.toLowerCase());
    const doc = await userRef.get();
    if (!doc.exists) {
      await userRef.set({
        walletAddress: wallet.toLowerCase(),
        creditPoints: 0,
        allowWithdraw: true,
        assets: {},
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('User registration error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Root route for health check
app.get('/', (req, res) => {
  res.send('✅ Web3 Backend is running!');
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
