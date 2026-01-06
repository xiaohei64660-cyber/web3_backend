const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Initialize Firebase from Railway environment variable
let db;
try {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  db = admin.firestore();
  console.log("✅ Firebase connected for web3_backend");
} catch (err) {
  console.error("🔥 Firebase init failed:", err.message);
}

// Public: DApp config endpoint
app.get('/api/config', (req, res) => {
  res.json({
    enabled: true,
    maintenance: false,
    supportedChains: [1, 137, 56, 8453, 42161, 10, 43114, 250],
    tokens: {
      1: [{ symbol: "ETH", address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", decimals: 18 }, { symbol: "USDC", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6 }],
      137: [{ symbol: "MATIC", address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", decimals: 18 }, { symbol: "USDC", address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", decimals: 6 }],
      56: [{ symbol: "BNB", address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", decimals: 18 }, { symbol: "USDC", address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", decimals: 6 }],
      8453: [{ symbol: "ETH", address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", decimals: 18 }, { symbol: "USDC", address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6 }],
      42161: [{ symbol: "ETH", address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", decimals: 18 }, { symbol: "USDC", address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", decimals: 6 }],
      10: [{ symbol: "ETH", address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", decimals: 18 }, { symbol: "USDC", address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", decimals: 6 }],
      43114: [{ symbol: "AVAX", address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", decimals: 18 }, { symbol: "USDC", address: "0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664", decimals: 6 }],
      250: [{ symbol: "FTM", address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", decimals: 18 }]
    },
    defaultSlippage: 0.5,
    announcements: ["Welcome to your Web3 trading platform!"]
  });
});

// Public: Get user data (credit points, assets, withdraw status)
app.get('/api/user/:wallet', async (req, res) => {
  try {
    const wallet = req.params.wallet.toLowerCase();
    if (!wallet.startsWith('0x') || wallet.length !== 42) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }
    if (!db) return res.json({ creditPoints: 0, allowWithdraw: true, assets: {} });

    const userDoc = await db.collection('users').doc(wallet).get();
    if (!userDoc.exists) {
      return res.json({ creditPoints: 0, allowWithdraw: true, assets: {} });
    }
    const data = userDoc.data();
    res.json({
      creditPoints: data.creditPoints || 0,
      allowWithdraw: data.allowWithdraw !== false,
      assets: data.assets || {}
    });
  } catch (err) {
    console.error('User fetch error:', err);
    res.json({ creditPoints: 0, allowWithdraw: true, assets: {} });
  }
});

// Public: Check withdraw permission
app.get('/api/withdraw-allowed/:wallet', async (req, res) => {
  try {
    const wallet = req.params.wallet.toLowerCase();
    if (!wallet.startsWith('0x') || wallet.length !== 42) {
      return res.json({ allowed: false });
    }
    if (!db) return res.json({ allowed: true });

    const userDoc = await db.collection('users').doc(wallet).get();
    if (userDoc.exists && userDoc.data().allowWithdraw === false) {
      return res.json({ allowed: false });
    }

    const configDoc = await db.collection('config').doc('platform').get();
    const globalAllowed = configDoc.exists 
      ? configDoc.data().allowWithdrawGlobally !== false 
      : true;
    res.json({ allowed: globalAllowed });
  } catch (err) {
    console.error('Withdraw check error:', err);
    res.json({ allowed: true });
  }
});

// Public: Register new user
app.post('/api/register', async (req, res) => {
  try {
    const { wallet } = req.body;
    if (!wallet || !wallet.startsWith('0x') || wallet.length !== 42) {
      return res.status(400).json({ error: 'Invalid wallet' });
    }
    if (!db) return res.json({ success: false });

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
    res.json({ success: false });
  }
});

// Health check endpoint
app.get('/', (req, res) => {
  res.send('✅ web3_backend is running!');
});

app.listen(PORT, () => {
  console.log(`🚀 web3_backend listening on port ${PORT}`);
});
