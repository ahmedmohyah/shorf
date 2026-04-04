import axios from 'axios';

async function test() {
  const uuid = '548b28e6-2733-11f1-9105-4638fdaf9e0b';
  const userId = '383987';
  const urls = [
    `https://cdn.geminigen.ai/outputs/${userId}/${uuid}.mp4`,
    `https://cdn.geminigen.ai/outputs/${userId}/${uuid}/${uuid}.mp4`,
    `https://cdn.geminigen.ai/outputs/${userId}/${uuid}_0.mp4`,
    `https://cdn.geminigen.ai/outputs/${userId}/${uuid}/${uuid}_0.mp4`,
    `https://cdn.geminigen.ai/outputs/${userId}/${uuid}_watermarked.mp4`,
    `https://cdn.geminigen.ai/outputs/${userId}/${uuid}/${uuid}_watermarked.mp4`,
    `https://cdn.geminigen.ai/outputs/${userId}/${uuid}_0_watermarked.mp4`,
    `https://cdn.geminigen.ai/outputs/${userId}/${uuid}/${uuid}_0_watermarked.mp4`,
    `https://cdn.geminigen.ai/videos/${userId}/${uuid}.mp4`,
    `https://cdn.geminigen.ai/videos/${userId}/${uuid}/${uuid}.mp4`,
    `https://cdn.geminigen.ai/videos/${userId}/${uuid}_0.mp4`,
    `https://cdn.geminigen.ai/videos/${userId}/${uuid}/${uuid}_0.mp4`,
    `https://cdn.geminigen.ai/results/${userId}/${uuid}.mp4`,
    `https://cdn.geminigen.ai/results/${userId}/${uuid}/${uuid}.mp4`,
    `https://cdn.geminigen.ai/results/${userId}/${uuid}_0.mp4`,
    `https://cdn.geminigen.ai/results/${userId}/${uuid}/${uuid}_0.mp4`,
    `https://cdn.geminigen.ai/last_frames/${userId}/${uuid}.mp4`,
    `https://cdn.geminigen.ai/last_frames/${userId}/${uuid}_last_frame.mp4`,
    `https://cdn.geminigen.ai/thumbnails/${userId}/${uuid}.mp4`,
    `https://cdn.geminigen.ai/thumbnails/${userId}/${uuid}/${uuid}.mp4`,
    `https://cdn.geminigen.ai/thumbnails/${userId}/${uuid}/${uuid}_0.mp4`,
    `https://cdn.geminigen.ai/thumbnails/${userId}/${uuid}/${uuid}_0_600px.mp4`,
    `https://cdn.geminigen.ai/outputs/${uuid}.mp4`,
    `https://cdn.geminigen.ai/videos/${uuid}.mp4`,
    `https://cdn.geminigen.ai/results/${uuid}.mp4`,
  ];
  
  for (const url of urls) {
    try {
      const res = await axios.head(url);
      console.log(`✅ SUCCESS: ${url} (Status: ${res.status})`);
    } catch (e: any) {
      console.log(`❌ FAILED: ${url}`);
    }
  }
}

test();
