import axios from 'axios';

async function test() {
  try {
    const res = await axios.get('http://localhost:3000/api/geminigen/history?filter_by=all&items_per_page=20&page=1');
    console.log(JSON.stringify(res.data.result.slice(0, 2), null, 2));
  } catch (e) {
    console.error(e);
  }
}

test();
