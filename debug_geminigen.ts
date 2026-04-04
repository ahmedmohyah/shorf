import axios from 'axios';

async function test() {
  try {
    const response = await axios.get(`https://api.geminigen.ai/uapi/v1/histories`, {
      params: { page: 1, filter_by: 'all', items_per_page: 5 },
      headers: {
        'x-api-key': 'geminiai-e098b97aa16085449c3eb4ad77b35142'
      }
    });
    
    if (response.data.result && response.data.result.length > 0) {
      for (const item of response.data.result) {
        const uuid = item.uuid;
        const userId = item.user_id;
        console.log(`Checking item: ${uuid}`);
        console.log(`generate_result: ${item.generate_result}`);
        console.log(`last_frame_url: ${item.last_frame_url}`);
        
        const patterns = [
            `https://cdn.geminigen.ai/outputs/${userId}/${uuid}/${uuid}_188.mp4`,
            `https://cdn.geminigen.ai/outputs/${userId}/${uuid}/${uuid}_189.mp4`,
            `https://cdn.geminigen.ai/outputs/${userId}/${uuid}/${uuid}_190.mp4`,
            `https://cdn.geminigen.ai/outputs/${userId}/${uuid}/${uuid}_191.mp4`,
            `https://cdn.geminigen.ai/videos/${userId}/${uuid}.mp4`,
            `https://cdn.geminigen.ai/videos/${userId}/${uuid}/${uuid}.mp4`,
            `https://cdn.geminigen.ai/results/${userId}/${uuid}.mp4`,
            `https://cdn.geminigen.ai/results/${userId}/${uuid}/${uuid}.mp4`,
        ];
        
        for (const url of patterns) {
            try {
                const res = await axios.head(url);
                console.log(`✅ SUCCESS: ${url} (Status: ${res.status})`);
            } catch (e: any) {
                // console.log(`❌ FAILED: ${url}`);
            }
        }
      }
    }
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

test();
