import { initializeApp } from 'firebase/app';
import { getFirestore, collection, writeBatch, doc } from 'firebase/firestore';
import express from 'express';
import Redis from 'ioredis';
import Queue from 'bull'; // Correct import

// Load environment variables
import 'dotenv/config'; // or require('dotenv').config();

const firebaseConfig = {
    apiKey: "AIzaSyAZAGEPIm_MOurLcsKo_sq1E8Ebyrs_kj8",
    authDomain: "zj-allied-tech.firebaseapp.com",
    projectId: "zj-allied-tech",
    storageBucket: "zj-allied-tech.appspot.com",
    messagingSenderId: "202020618968",
    appId: "1:202020618968:web:c9c18bd9a15b462f088dad",
    measurementId: "G-XL0NCKQFDZ"
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

// Initialize Express
const app = express();
const port = process.env.PORT || 3000;
app.use(express.json());

// Initialize and test Redis client
let redisClient;
try {
    redisClient = new Redis(process.env.REDIS_URL + '?family=0', {
        lazyConnect: true,
        connectTimeout: 5000,
        maxRetriesPerRequest: 3,
        tls: { rejectUnauthorized: false }
    });

    await redisClient.connect();
    console.log('Connected to Redis successfully');
} catch (e) {
    console.log('Redis connection error:', e);
    process.exit(1); // Exit the process if Redis connection fails
}

// Initialize Bull Queue
const messageQueue = new Queue('messageQueue', {
    createClient: (type) => {
        switch (type) {
            case 'client':
                return redisClient;
            case 'subscriber':
                return new Redis(process.env.REDIS_URL + '?family=0', {
                    lazyConnect: true,
                    connectTimeout: 5000,
                    maxRetriesPerRequest: 3,
                    tls: { rejectUnauthorized: false }
                });
            default:
                return new Redis(process.env.REDIS_URL + '?family=0', {
                    lazyConnect: true,
                    connectTimeout: 5000,
                    maxRetriesPerRequest: 3,
                    tls: { rejectUnauthorized: false }
                });
        }
    }
});

// Route to enqueue data
app.post('/uploadData', async (req, res) => {
    try {
        const { from, to, message } = req.body;

        if (!from || !to || !message) {
            return res.status(400).json({ error: "Missing required fields: 'from', 'to', 'message'" });
        }

        const timestamp = new Date().toISOString();

        // Data to enqueue
        const data = {
            from,
            to,
            message,
            createdAt: timestamp
        };

        await messageQueue.add(data);

        res.status(200).json({ message: 'Data enqueued successfully' });
    } catch (error) {
        console.error('Error enqueuing data: ', error);
        res.status(500).json({ error: 'Error enqueuing data' });
    }
});

// Function to batch process queued data
const processQueue = async () => {
    const batchSize = 100; // Number of messages to process in each batch
    const jobs = await messageQueue.getJobs(['waiting', 'active'], 0, batchSize);

    const batchData = jobs.map(job => job.data);

    // Batch upload to Firestore
    const batch = writeBatch(db);
    batchData.forEach(data => {
        const docRef = doc(collection(db, 'DateNumber'));
        batch.set(docRef, data);
    });

    await batch.commit();
    console.log('Batch data uploaded successfully');

    // Remove processed jobs from the queue
    jobs.forEach(job => job.remove());
};

// Schedule batch processing every few minutes
setInterval(processQueue, 5 * 60 * 1000); // 5 minutes

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
