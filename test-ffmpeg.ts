import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import { createCanvas } from "canvas";
import fs from "fs";
import path from "path";
import os from "os";

if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

async function test() {
  const overlayImagePath = path.join(os.tmpdir(), `overlay-test.png`);
  const dummyVideoPath = path.join(os.tmpdir(), `dummy.mp4`);
  const processedVideoPath = path.join(os.tmpdir(), `processed-test.mp4`);
  
  // Create a 1-second dummy video using ffmpeg
  await new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input('color=c=black:s=1080x1920:d=1')
      .inputFormat('lavfi')
      .outputOptions(['-c:v libx264', '-preset ultrafast'])
      .save(dummyVideoPath)
      .on('end', () => {
        console.log('Dummy video created.');
        resolve();
      })
      .on('error', reject);
  });

  // Now test the merging
  await new Promise<void>((resolve, reject) => {
    ffmpeg(dummyVideoPath)
      .input(overlayImagePath)
      .complexFilter(['[0:v][1:v]overlay=0:0'])
      .outputOptions(['-c:v libx264', '-preset ultrafast', '-crf 23'])
      .save(processedVideoPath)
      .on('end', () => {
        console.log('Video processing finished.');
        resolve();
      })
      .on('error', reject);
  });
}

test().catch(console.error);
