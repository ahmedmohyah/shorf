import axios from 'axios';

async function test() {
  try {
    const response = await axios.get(`https://api.geminigen.ai/uapi/v1/tasks/2d833128-2768-11f1-9b5c-aa7ff7d7c0d4`, {
      headers: {
        'x-api-key': 'geminiai-e098b97aa16085449c3eb4ad77b35142'
      }
    });
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

test();
