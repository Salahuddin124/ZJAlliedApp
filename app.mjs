import express from 'express';
import cors from 'cors'; // Import cors
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import 'dotenv/config';
import cron from 'node-cron';
import fs from 'fs';
import moment from 'moment-timezone';
import { MongoClient } from 'mongodb';


const mongoUrl = process.env.MONGO_URL || "aaa";
const mongoClient = new MongoClient(mongoUrl);





const app = express();
const port = process.env.PORT || 3000;


app.use(cors()); 
app.use(express.json());





app.get('/queryData', async (req, res) => {
   
    try {
        const { startDate, endDate, searchTerm, limit = 50, skip } = req.query;
       

        const queryCriteria = {};

    
        if (startDate && endDate) {
            const start = startDate;
            const end = endDate;
            queryCriteria.createdAt = { $gte: start, $lte: end };
        }


        if (searchTerm) {
           
            queryCriteria.to = { $regex: new RegExp(`^${searchTerm}$`, 'i') }; // Match exact number
        }

        const db = mongoClient.db('ZjAlliedApp');
        const collection = db.collection('DateNumber');

       
        const pageNumber = parseInt(skip) || 1;
        const itemsPerPage = Math.min(parseInt(limit), 50);
        const skipItems = (pageNumber - 1) * itemsPerPage;
    
      

        // Fetch data with pagination
        const results = await collection.find(queryCriteria)
            .skip(parseInt(skip)) // Skip the number of items based on the page number
            .limit(itemsPerPage) // Fetch only the number of items per page
            .toArray();

        // Send results and pagination info
        res.status(200).json({
            data: results,
            page: skip,
            limit: itemsPerPage,
            totalResults: results.length
        });
    } catch (error) {
        console.error('Error querying data:', error);
        res.status(500).json({ error: 'Error querying data' });
    }
});



app.get('/data', async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
  
      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'startDate and endDate are required.' });
      }
  
    
  
     
  
      if (!startDate|| !endDate) {
        return res.status(400).json({ error: 'Invalid date format.' });
      }
  
      const query = {
        createdAt: {
          $gte: startDate,
          $lte: endDate,
        },
      };
  
      const db = mongoClient.db('ZjAlliedApp');
      const collection = db.collection('DateNumber');
  
      const data = await collection.find(query).toArray();
  
     
  
      res.status(200).json(data);
    } catch (error) {
      console.error('Error fetching data:', error);
      res.status(500).json({ error: 'An error occurred while fetching datas.' });
    }
  });
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
