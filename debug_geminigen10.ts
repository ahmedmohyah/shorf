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
      const validItems = response.data.result.filter((item: any) => item.file_size > 0 || item.generate_result);
      console.log(`Found ${validItems.length} valid items out of ${response.data.result.length}`);
      
      if (validItems.length > 0) {
        console.log(JSON.stringify(validItems[0], null, 2));
      } else {
        // Let's print the first item anyway to see what it looks like
        console.log(JSON.stringify(response.data.result[0], null, 2));
      }
    }
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

test();
