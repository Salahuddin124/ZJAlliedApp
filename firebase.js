import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyAZAGEPIm_MOurLcsKo_sq1E8Ebyrs_kj8",
    authDomain: "zj-allied-tech.firebaseapp.com",
    projectId: "zj-allied-tech",
    storageBucket: "zj-allied-tech.appspot.com",
    messagingSenderId: "202020618968",
    appId: "1:202020618968:web:c9c18bd9a15b462f088dad",
    measurementId: "G-XL0NCKQFDZ"
  
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { app, db };
