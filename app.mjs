import { initializeApp } from 'firebase/app';
import { getFirestore, collection, writeBatch, doc } from 'firebase/firestore';
import express from 'express';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import 'dotenv/config';
import cron from 'node-cron';

import moment from 'moment-timezone';

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCQ93kH_ERQ31g-1lZMK_0EnDHuceb1MHA",
    authDomain: "zjalliedapp.firebaseapp.com",
    projectId: "zjalliedapp",
    storageBucket: "zjalliedapp.appspot.com",
    messagingSenderId: "238126670586",
    appId: "1:238126670586:web:cfc26b0ad45842a9199f43",
    measurementId: "G-PYLYR7KQYD"
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
        const timestamp = moment().tz('Asia/Karachi').utc().format('YYYY-MM-DDTHH:mm:ss.SSS[Z]');

        if (!from || !to || !message) {
            // Log entry for missing fields
            
            return res.status(400).json({ error: "Missing required fields: 'from', 'to', 'message'" });
        }

        // Data to cache
        const data = {
            from,
            to,
            message,
            createdAt: timestamp
        };

        // Write data to README.txt
       

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
        const batchSize = 200; // Updated batch size
        const keys = await redis.keys('*');

        if (keys.length > 0) {
            for (let i = 0; i < keys.length; i += batchSize) {
                const batchKeys = keys.slice(i, i + batchSize);
                const batch = writeBatch(db);

                const pipeline = redis.pipeline();
                batchKeys.forEach(key => pipeline.get(key));
                const results = await pipeline.exec();

                results.forEach(([err, data], index) => {
                    if (err) {
                        console.error(`Error getting data for key ${batchKeys[index]}: `, err);
                        return;
                    }

                    try {
                        const parsedData = JSON.parse(data);
                        if (typeof parsedData === 'object' && parsedData !== null) {
                            const docRef = doc(collection(db, 'DateNumber'));
                            batch.set(docRef, parsedData);
                        } else {
                            console.error(`Invalid data format for key ${batchKeys[index]}: `, parsedData);
                        }
                    } catch (parseError) {
                        console.error(`Error parsing data for key ${batchKeys[index]}: `, parseError);
                    }

                    // Remove processed items from cache
                    redis.del(batchKeys[index]);
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

// Schedule batch processing every 2 seconds using cron
cron.schedule('*/2 * * * * *', processQueue);

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
