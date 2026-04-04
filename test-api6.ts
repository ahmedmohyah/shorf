import axios from 'axios';

async function test() {
  try {
    const res = await axios.get('http://localhost:3000/api/geminigen/history?filter_by=all&items_per_page=100&page=1');
    const items = res.data.result;
    const withResult = items.filter(i => i.generate_result);
    console.log("Items with generate_result:", withResult.length);
    if (withResult.length > 0) {
      console.log(withResult[0].generate_result);
    }
  } catch (e) {
    console.error(e.message);
  }
}

test();
