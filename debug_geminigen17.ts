import axios from 'axios';

async function test() {
  try {
    const response = await axios.get(`https://api.geminigen.ai/uapi/v1/histories`, {
      params: { page: 1, filter_by: 'all', items_per_page: 100 },
      headers: {
        'x-api-key': 'geminiai-e098b97aa16085449c3eb4ad77b35142'
      }
    });
    
    if (response.data.result && response.data.result.length > 0) {
      const item = response.data.result.find((i: any) => i.uuid === '548b28e6-2733-11f1-9105-4638fdaf9e0b');
      if (item) {
        console.log(JSON.stringify(item, null, 2));
      } else {
        console.log('Item not found in the first 100 results');
      }
    }
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

test();
