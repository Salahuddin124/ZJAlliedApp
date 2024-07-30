import { initializeApp } from 'firebase/app';
import { getFirestore, collection, writeBatch, doc } from 'firebase/firestore';
import express from 'express';
import NodeCache from 'node-cache';

// Load environment variables
import 'dotenv/config';

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCttsrCMougKC_3hL61HPnkWGYP_AIkaEs",
    authDomain: "zjallied2.firebaseapp.com",
    projectId: "zjallied2",
    storageBucket: "zjallied2.appspot.com",
    messagingSenderId: "129442800699",
    appId: "1:129442800699:web:d8bbcd05b66f6e07d0681e",
    measurementId: "G-GE4FT3TJLG"
  };

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

// Initialize Express
const app = express();
const port = process.env.PORT || 3000;
app.use(express.json());

// Initialize in-memory cache
const cache = new NodeCache({
    stdTTL: 600, // Time to live in seconds (10 minutes)
    checkperiod: 120, // Interval in seconds to check for expired keys
    useClones: false, // Do not clone the cached objects (saves memory)
    deleteOnExpire: true // Delete expired items
});

// Route to enqueue data
app.post('/uploadData', async (req, res) => {
    try {
        const { from, to, message } = req.body;

        if (!from || !to || !message) {
            return res.status(400).json({ error: "Missing required fields: 'from', 'to', 'message'" });
        }

        const timestamp = new Date().toISOString();

        // Data to cache
        const data = {
            from,
            to,
            message,
            createdAt: timestamp
        };

        // Store the data in the cache
        const cacheKey = `data_${timestamp}_${from}_${to}`;
        cache.set(cacheKey, data);

        res.status(200).json({ message: 'Data cached successfully' });
    } catch (error) {
        console.error('Error caching data: ', error);
        res.status(500).json({ error: 'Error caching data' });
    }
});

// Function to batch process cached data
const processQueue = async () => {
    const keys = cache.keys();
    if (keys.length > 0) {
        // Batch upload to Firestore
        const batch = writeBatch(db);
        keys.forEach(key => {
            const data = cache.get(key);
            if (data) {
                const docRef = doc(collection(db, 'DateNumber'));
                batch.set(docRef, data);
                cache.del(key); // Remove processed items from cache
            }
        });

        await batch.commit();
        console.log('Batch data uploaded successfully');
    }
};

// Schedule batch processing every few minutes
setInterval(processQueue, 5 * 60 * 1000); // 5 minutes

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
