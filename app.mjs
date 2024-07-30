import { initializeApp } from 'firebase/app';
import { getFirestore, collection, writeBatch, doc } from 'firebase/firestore';
import express from 'express';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import 'dotenv/config';
import cluster from 'cluster';
import os from 'os';
import cron from 'node-cron';

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

// Initialize Redis
const redis = new Redis();

// Initialize Express
const app = express();
const port = process.env.PORT || 3000;
app.use(express.json());

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

        // Generate a unique cache key using UUID
        const cacheKey = uuidv4();
        await redis.set(cacheKey, JSON.stringify(data), 'EX', 600);

        res.status(200).json({ message: 'Data cached successfully', id: cacheKey });
    } catch (error) {
        console.error('Error caching data: ', error);
        res.status(500).json({ error: 'Error caching data' });
    }
});

// Function to batch process cached data
const processQueue = async () => {
    try {
        const batchSize = 80; // Number of messages to process in each batch
        const keys = await redis.keys('*');

        if (keys.length > 0) {
            for (let i = 0; i < keys.length; i += batchSize) {
                const batchKeys = keys.slice(i, i + batchSize);
                const batch = writeBatch(db);

                const pipeline = redis.pipeline();
                batchKeys.forEach(key => pipeline.get(key));
                const results = await pipeline.exec();

                results.forEach(([err, data], index) => {
                    if (data) {
                        const docRef = doc(collection(db, 'DateNumber'));
                        batch.set(docRef, JSON.parse(data));
                        redis.del(batchKeys[index]); // Remove processed items from cache
                    }
                });

                await batch.commit();
                console.log(`Batch of ${batchKeys.length} documents uploaded successfully`);
            }
        } else {
            console.log('No data to process');
        }
    } catch (error) {
        console.error('Error processing queue: ', error);
    }
};

// Schedule batch processing every minute using cron
cron.schedule('* * * * *', processQueue);

if (cluster.isMaster) {
    // Fork workers
    const numCPUs = os.cpus().length;
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
        console.log(`Worker ${worker.process.pid} died`);
        cluster.fork();
    });
} else {
    app.listen(port, () => {
        console.log(`Server is running on http://localhost:${port}`);
    });
}
