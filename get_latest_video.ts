import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf-8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function getLatestVideo() {
  try {
    const q = query(collection(db, 'scheduledVideos'), orderBy('createdAt', 'desc'), limit(5));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      console.log('No videos found in Firestore.');
      return;
    }

    console.log('Latest videos in Firestore:');
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      console.log(`ID: ${doc.id}`);
      console.log(`Title: ${data.title}`);
      console.log(`Video URL: ${data.videoUrl}`);
      console.log(`Status: ${data.status}`);
      console.log(`Publish Status: ${data.publishStatus}`);
      console.log(`YouTube URL: ${data.youtubeUrl}`);
      console.log('-------------------');
    });
  } catch (error) {
    console.error('Error fetching videos:', error);
  }
}

getLatestVideo();
