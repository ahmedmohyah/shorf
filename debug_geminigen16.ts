import axios from 'axios';

async function test() {
  const urls = [
    'https://api.geminigen.ai/uapi/v1/histories/download/2d833128-2768-11f1-9b5c-aa7ff7d7c0d4',
    'https://api.geminigen.ai/uapi/v1/download/2d833128-2768-11f1-9b5c-aa7ff7d7c0d4',
    'https://api.geminigen.ai/uapi/v1/videos/2d833128-2768-11f1-9b5c-aa7ff7d7c0d4',
    'https://api.geminigen.ai/uapi/v1/tasks/2d833128-2768-11f1-9b5c-aa7ff7d7c0d4/download',
  ];
  
  for (const url of urls) {
    try {
      const res = await axios.get(url, {
        headers: {
          'x-api-key': 'geminiai-e098b97aa16085449c3eb4ad77b35142'
        }
      });
      console.log(`✅ SUCCESS: ${url} (Status: ${res.status})`);
    } catch (e: any) {
      console.log(`❌ FAILED: ${url}`);
    }
  }
}

test();
