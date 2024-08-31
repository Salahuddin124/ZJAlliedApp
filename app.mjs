import express from 'express';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import 'dotenv/config';
import cron from 'node-cron';
import fs from 'fs';
import moment from 'moment-timezone';
import { MongoClient } from 'mongodb';

// MongoDB connection
const mongoUrl = process.env.MONGO_URI;
const mongoClient = new MongoClient(mongoUrl);

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
            return res.status(400).json({ error: timestamp });
        }

        // Data to cache
        const data = {
            from,
            to,
            message,
            createdAt: timestamp
        };

        // Write data to README.txt
        const logEntry = `From: ${from}\nTo: ${to}\nMessage: ${message}\nTimestamp: ${timestamp}\n\n`;
        fs.appendFileSync('README.txt', logEntry, 'utf8');

        // Generate a unique cache key using UUID
        const cacheKey = uuidv4();
        await redis.set(cacheKey, JSON.stringify(data), 'EX', 600);

        res.status(200).json({ message: 'Data cached successfully', id: cacheKey });
    } catch (error) {
        console.error('Error caching data: ', error);
        res.status(500).json({ error: 'Error caching data' });
    }
});

// Function to batch process cached data and upload to MongoDB
const processQueue = async () => {
    try {
        const batchSize = 200; // Updated batch size
        const keys = await redis.keys('*');

        if (keys.length > 0) {
            const batchData = [];

            for (let i = 0; i < keys.length; i += batchSize) {
                const batchKeys = keys.slice(i, i + batchSize);
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
                            batchData.push(parsedData);
                        } else {
                            console.error(`Invalid data format for key ${batchKeys[index]}: `, parsedData);
                        }
                    } catch (parseError) {
                        console.error(`Error parsing data for key ${batchKeys[index]}: `, parseError);
                    }

                    // Remove processed items from cache
                    redis.del(batchKeys[index]);
                });

                if (batchData.length > 0) {
                    // Insert batch data into MongoDB
                    const db = mongoClient.db('ZjAlliedApp'); // Use your MongoDB database name
                    const collection = db.collection('DateNumber');
                    await collection.insertMany(batchData);
                    console.log(`Batch of ${batchKeys.length} documents uploaded successfully`);
                }
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
    mongoClient.connect(err => {
        if (err) {
            console.error('Error connecting to MongoDB: ', err);
        } else {
            console.log('Connected to MongoDB');
        }
    });
});
