import axios from 'axios';

async function test() {
  try {
    const res = await axios.head('https://cdn.geminigen.ai/videos/383987/2d833128-2768-11f1-9b5c-aa7ff7d7c0d4.mp4');
    console.log("videos folder:", res.status);
  } catch (e) {
    console.error("videos folder:", e.message);
  }
  
  try {
    const res = await axios.head('https://cdn.geminigen.ai/results/383987/2d833128-2768-11f1-9b5c-aa7ff7d7c0d4.mp4');
    console.log("results folder:", res.status);
  } catch (e) {
    console.error("results folder:", e.message);
  }

  try {
    const res = await axios.head('https://cdn.geminigen.ai/last_frames/383987/2d833128-2768-11f1-9b5c-aa7ff7d7c0d4.mp4');
    console.log("last_frames folder:", res.status);
  } catch (e) {
    console.error("last_frames folder:", e.message);
  }
}

test();
