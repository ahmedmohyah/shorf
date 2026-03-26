import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf-8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function checkVideos() {
  const snapshot = await getDocs(collection(db, 'scheduledVideos'));
  console.log(`Found ${snapshot.docs.length} videos in Firestore.`);
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    console.log(`ID: ${doc.id}, Title: ${data.title}, VideoUrl: ${data.videoUrl}, Status: ${data.status}`);
  });
}

checkVideos();
