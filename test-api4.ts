import axios from 'axios';

async function test() {
  try {
    const res = await axios.head('https://cdn.geminigen.ai/results/383987/2d833128-2768-11f1-9b5c-aa7ff7d7c0d4/2d833128-2768-11f1-9b5c-aa7ff7d7c0d4.mp4');
    console.log("results folder with uuid:", res.status);
  } catch (e) {
    console.error("results folder with uuid:", e.message);
  }
}

test();
