import axios from 'axios';

async function test() {
  try {
    const res = await axios.get('http://localhost:3000/api/geminigen/history?filter_by=all&items_per_page=10&page=1');
    const items = res.data.result;
    for (const item of items) {
      if (item.last_frame_url) {
        const url = item.last_frame_url.replace('_last_frame.jpg', '.mp4');
        try {
          const head = await axios.head(url);
          console.log(url, head.status);
        } catch (e) {
          console.error(url, e.message);
        }
      }
    }
  } catch (e) {
    console.error(e.message);
  }
}

test();
