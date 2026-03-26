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
  
  // Create a 10-second dummy landscape video using ffmpeg
  await new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input('color=c=blue:s=1920x1080:d=10')
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
