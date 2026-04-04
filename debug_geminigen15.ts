import axios from 'axios';

async function test() {
  try {
    const response = await axios.post(`https://api.geminigen.ai/uapi/v1/tasks`, {
      model_name: "veo-3.1-fast",
      input_text: "A cat driving a car",
      type: "video"
    }, {
      headers: {
        'x-api-key': 'geminiai-e098b97aa16085449c3eb4ad77b35142'
      }
    });
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    console.error('Error:', error.response ? error.response.data : error.message);
  }
}

test();
