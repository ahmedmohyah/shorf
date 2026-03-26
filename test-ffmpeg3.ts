import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import { createCanvas } from "canvas";
import fs from "fs";
import path from "path";
import os from "os";
import axios from "axios";

if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

async function test() {
  const overlayImagePath = path.join(os.tmpdir(), `overlay-test.png`);
  const dummyVideoPath = path.join(os.tmpdir(), `dummy.mp4`);
  const processedVideoPath = path.join(os.tmpdir(), `processed-test.mp4`);
  
  // Download dummy video
  console.log('Downloading dummy video...');
  const response = await axios({
    method: 'GET',
    url: 'https://vjs.zencdn.net/v/oceans.mp4',
    responseType: 'stream'
  });
  const writer = fs.createWriteStream(dummyVideoPath);
  response.data.pipe(writer);
  await new Promise((resolve) => writer.on('finish', resolve));
  console.log('Dummy video downloaded.');

  // Now test the merging
  await new Promise<void>((resolve, reject) => {
    ffmpeg(dummyVideoPath)
      .input(overlayImagePath)
      .complexFilter([
        '[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920[bg]',
        '[bg][1:v]overlay=0:0'
      ])
      .outputOptions(['-c:v libx264', '-preset ultrafast', '-crf 23', '-t 8'])
      .save(processedVideoPath)
      .on('end', () => {
        console.log('Video processing finished.');
        resolve();
      })
      .on('error', reject);
  });
}

test().catch(console.error);
