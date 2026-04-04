import axios from 'axios';

async function test() {
  const urls = [
    'https://cdn.geminigen.ai/thumbnails/383987/2d833128-2768-11f1-9b5c-aa7ff7d7c0d4/2d833128-2768-11f1-9b5c-aa7ff7d7c0d4_0.mp4',
    'https://cdn.geminigen.ai/thumbnails/383987/2d833128-2768-11f1-9b5c-aa7ff7d7c0d4/2d833128-2768-11f1-9b5c-aa7ff7d7c0d4.mp4',
    'https://cdn.geminigen.ai/thumbnails/383987/2d833128-2768-11f1-9b5c-aa7ff7d7c0d4_0.mp4',
    'https://cdn.geminigen.ai/thumbnails/383987/2d833128-2768-11f1-9b5c-aa7ff7d7c0d4.mp4',
  ];
  
  for (const url of urls) {
    try {
      const res = await axios.head(url);
      console.log(`✅ SUCCESS: ${url} (Status: ${res.status})`);
    } catch (e: any) {
      console.log(`❌ FAILED: ${url}`);
    }
  }
}

test();
