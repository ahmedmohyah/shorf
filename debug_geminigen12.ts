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
      const statuses = new Set(response.data.result.map((item: any) => item.status));
      console.log(`Statuses found:`, Array.from(statuses));
      
      for (const status of statuses) {
        const item = response.data.result.find((i: any) => i.status === status);
        console.log(`\nExample item with status ${status}:`);
        console.log(`uuid: ${item.uuid}`);
        console.log(`generate_result: ${item.generate_result}`);
        console.log(`file_size: ${item.file_size}`);
        console.log(`error_message: ${item.error_message}`);
      }
    }
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

test();
