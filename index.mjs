import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc } from 'firebase/firestore';
import express from 'express';

// Replace with your Firebase project configuration
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

// Get a Firestore instance
const db = getFirestore(firebaseApp);

const app = express();
const port = process.env.PORT || 3000;
app.use(express.json());


  app.post('/uploadData', async (req, res) => {
    try {
     
      const { from, to, message } = req.body;
  
      if (!from || !to || !message) {
        return res.status(400).json({ error: "Missing required fields: 'from', 'to', 'message'" });
      }
  
      // Check if 'from' is a number
      if (typeof from !== 'number') {
        return res.status(400).json({ error: "'from' must be a number" });
      }
  
      // Generate current timestamp in ISO 8601 format
      const timestamp = new Date().toISOString();
  
      // Data to upload
      const data = {
        from: from,
        to: to,
        message: message,
        createdAt: timestamp
      };
  

      const docRef = await addDoc(collection(db, 'DateNumber'), data);
      console.log('Document written with ID: ', docRef.id);
  
    
      res.status(200).json({ message: 'Data uploaded successfully', docId: docRef.id });
    } catch (error) {
      console.error('Error uploading data: ', error);
      // Send JSON response indicating error
      res.status(500).json({ error: 'Error uploading data' });
    }
  });

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
