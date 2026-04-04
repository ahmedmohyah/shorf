import express from "express";
import cors from "cors";
import yts from "yt-search";
import { createServer as createViteServer } from "vite";
import path from "path";
import { google } from "googleapis";
import dotenv from "dotenv";
import fs from "fs";
import axios from "axios";
import os from "os";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import { createCanvas, registerFont } from "canvas";

if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

dotenv.config();

const fontsToDownload = [
  { name: 'Cairo', url: 'https://github.com/google/fonts/raw/main/ofl/cairo/Cairo-Bold.ttf', file: 'Cairo-Bold.ttf' },
  { name: 'Amiri', url: 'https://github.com/google/fonts/raw/main/ofl/amiri/Amiri-Bold.ttf', file: 'Amiri-Bold.ttf' },
  { name: 'Lalezar', url: 'https://github.com/google/fonts/raw/main/ofl/lalezar/Lalezar-Regular.ttf', file: 'Lalezar-Regular.ttf' },
  { name: 'Tajawal', url: 'https://github.com/google/fonts/raw/main/ofl/tajawal/Tajawal-Bold.ttf', file: 'Tajawal-Bold.ttf' },
  { name: 'Changa', url: 'https://github.com/google/fonts/raw/main/ofl/changa/Changa-Bold.ttf', file: 'Changa-Bold.ttf' },
  { name: 'Aref Ruqaa', url: 'https://github.com/google/fonts/raw/main/ofl/arefruqaa/ArefRuqaa-Bold.ttf', file: 'ArefRuqaa-Bold.ttf' },
  { name: 'Reem Kufi', url: 'https://github.com/google/fonts/raw/main/ofl/reemkufi/ReemKufi-Bold.ttf', file: 'ReemKufi-Bold.ttf' },
  { name: 'Readex Pro', url: 'https://github.com/google/fonts/raw/main/ofl/readexpro/ReadexPro-Bold.ttf', file: 'ReadexPro-Bold.ttf' },
  { name: 'Lemonada', url: 'https://github.com/google/fonts/raw/main/ofl/lemonada/Lemonada-Bold.ttf', file: 'Lemonada-Bold.ttf' },
  { name: 'Lateef', url: 'https://github.com/google/fonts/raw/main/ofl/lateef/Lateef-Regular.ttf', file: 'Lateef-Regular.ttf' }
];

async function downloadFonts() {
  for (const font of fontsToDownload) {
    const fontPath = path.join(os.tmpdir(), font.file);
    if (!fs.existsSync(fontPath)) {
      console.log(`Downloading ${font.name} font...`);
      try {
        const response = await axios({
          method: 'GET',
          url: font.url,
          responseType: 'stream'
        });
        const writer = fs.createWriteStream(fontPath);
        response.data.pipe(writer);
        await new Promise<void>((resolve, reject) => {
          writer.on('finish', () => resolve());
          writer.on('error', reject);
        });
        console.log(`${font.name} font downloaded successfully.`);
      } catch (error) {
        console.error(`Failed to download ${font.name} font:`, error);
      }
    }
    try {
      registerFont(fontPath, { family: font.name });
    } catch (e) {
      console.error(`Failed to register font ${font.name}:`, e);
    }
  }
}
downloadFonts();

const baseTemplates = {
  'sigma': { font: 'Cairo', style: 'slanted', align: 'center', yOffset: 150 },
  'vintage': { font: 'Amiri', style: 'ribbon', align: 'center', yOffset: 150 },
  'news': { font: 'Tajawal', style: 'solid', align: 'center', yOffset: 150 },
  'story': { font: 'Aref Ruqaa', style: 'elegant', align: 'center', yOffset: 150 },
  'tech': { font: 'Changa', style: 'neon', align: 'center', yOffset: 150 },
  'sports': { font: 'Lalezar', style: 'dynamic', align: 'center', yOffset: 150 },
  'quotes': { font: 'Reem Kufi', style: 'minimal', align: 'center', yOffset: 500 },
  'education': { font: 'Readex Pro', style: 'highlight', align: 'center', yOffset: 150 },
  'gaming': { font: 'Lemonada', style: 'pixel', align: 'center', yOffset: 150 },
  'islamic': { font: 'Lateef', style: 'calligraphy', align: 'center', yOffset: 150 },
  'diamond': { font: 'Cairo', style: 'diamond', align: 'center', yOffset: 150 },
  'ocean': { font: 'Cairo', style: 'ocean', align: 'center', yOffset: 150 },
  'orange': { font: 'Cairo', style: 'orange-ribbon', align: 'center', yOffset: 150 },
  'red': { font: 'Cairo', style: 'red-ribbon', align: 'center', yOffset: 150 },
  'history': { font: 'Cairo', style: 'history-lines', align: 'center', yOffset: 150 },
  'default': { font: 'Cairo', style: 'solid', align: 'center', yOffset: 150 }
};

const colorPalette = {
  'red': '#EF4444',
  'blue': '#3B82F6',
  'green': '#10B981',
  'gold': '#F59E0B',
  'default': '#EF4444'
};

async function generateOverlayImage(text: string, outputPath: string, templateId: string = 'default') {
  const width = 1080;
  const height = 1920;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Parse templateId (e.g., 'sigma-red')
  const [baseId, colorId] = templateId.split('-');
  const template = baseTemplates[baseId as keyof typeof baseTemplates] || baseTemplates['default'];
  const primaryColor = colorPalette[colorId as keyof typeof colorPalette] || colorPalette['default'];

  ctx.clearRect(0, 0, width, height);

  // Split text into title and body if there's a double newline
  const parts = text.split('\n\n');
  const title = parts.length > 1 ? parts[0] : '';
  const bodyText = parts.length > 1 ? parts.slice(1).join('\n\n') : text;

  // Add a gradient at the bottom for readability
  const gradientHeight = template.yOffset === 500 ? 1200 : 800;
  const gradientStart = height - gradientHeight;
  const gradient = ctx.createLinearGradient(0, gradientStart, 0, height);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(0.5, 'rgba(0,0,0,0.7)');
  gradient.addColorStop(1, 'rgba(0,0,0,0.9)');
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, gradientStart, width, gradientHeight);

  ctx.textAlign = template.align as CanvasTextAlign;
  ctx.textBaseline = 'middle';

  // Add shadow for better readability
  ctx.shadowColor = 'rgba(0, 0, 0, 1)';
  ctx.shadowBlur = 15;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 4;

  const maxWidth = 900;
  let currentY = height - template.yOffset; // Start from bottom and go up

  // Process body text
  ctx.font = `bold 50px ${template.font}`;
  const bodyLines = bodyText.split('\n');
  const processedBodyLines: string[] = [];
  
  for (const paragraph of bodyLines) {
    const words = paragraph.split(' ');
    let line = '';
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        processedBodyLines.push(line);
        line = words[n] + ' ';
      } else {
        line = testLine;
      }
    }
    processedBodyLines.push(line);
  }

  // Draw body text from bottom up
  const bodyLineHeight = 80;
  ctx.fillStyle = '#FFFFFF';
  const xPos = template.align === 'right' ? width - 90 : (template.align === 'left' ? 90 : width / 2);
  
  for (let i = processedBodyLines.length - 1; i >= 0; i--) {
    ctx.fillText(processedBodyLines[i], xPos, currentY);
    currentY -= bodyLineHeight;
  }

  // Draw title
  if (title) {
    currentY -= 40; // Add some space between title and body
    ctx.font = `900 80px ${template.font}`; // Black/bolder font for title
    
    const titleWords = title.split(' ');
    let titleLine = '';
    const titleLines: string[] = [];
    
    for (let n = 0; n < titleWords.length; n++) {
      const testLine = titleLine + titleWords[n] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        titleLines.push(titleLine);
        titleLine = titleWords[n] + ' ';
      } else {
        titleLine = testLine;
      }
    }
    titleLines.push(titleLine);

    const titleLineHeight = 110;
    for (let i = titleLines.length - 1; i >= 0; i--) {
      const line = titleLines[i].trim();
      const textWidth = ctx.measureText(line).width;
      
      // Draw title background based on style
      ctx.save();
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = primaryColor;
      
      const paddingX = 40;
      const paddingY = 20;
      const bgWidth = textWidth + paddingX * 2;
      const bgHeight = 100;
      const bgX = template.align === 'center' ? xPos - bgWidth / 2 : (template.align === 'right' ? xPos - textWidth - paddingX : xPos - paddingX);
      const bgY = currentY - bgHeight / 2;

      if (template.style === 'slanted') {
        ctx.beginPath();
        ctx.moveTo(bgX + 20, bgY);
        ctx.lineTo(bgX + bgWidth, bgY);
        ctx.lineTo(bgX + bgWidth - 20, bgY + bgHeight);
        ctx.lineTo(bgX, bgY + bgHeight);
        ctx.closePath();
        ctx.fill();
      } else if (template.style === 'ribbon') {
        ctx.fillRect(bgX, bgY, bgWidth, bgHeight);
        // Ribbon tails
        ctx.beginPath();
        ctx.moveTo(bgX, bgY);
        ctx.lineTo(bgX - 20, bgY + bgHeight / 2);
        ctx.lineTo(bgX, bgY + bgHeight);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(bgX + bgWidth, bgY);
        ctx.lineTo(bgX + bgWidth + 20, bgY + bgHeight / 2);
        ctx.lineTo(bgX + bgWidth, bgY + bgHeight);
        ctx.fill();
      } else if (template.style === 'solid' || template.style === 'highlight') {
        ctx.fillRect(bgX, bgY, bgWidth, bgHeight);
      } else if (template.style === 'neon') {
        ctx.shadowColor = primaryColor;
        ctx.shadowBlur = 20;
        ctx.strokeStyle = primaryColor;
        ctx.lineWidth = 4;
        ctx.strokeRect(bgX, bgY, bgWidth, bgHeight);
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(bgX, bgY, bgWidth, bgHeight);
      } else if (template.style === 'dynamic') {
        ctx.beginPath();
        ctx.moveTo(bgX, bgY);
        ctx.lineTo(bgX + bgWidth, bgY - 10);
        ctx.lineTo(bgX + bgWidth, bgY + bgHeight);
        ctx.lineTo(bgX, bgY + bgHeight + 10);
        ctx.closePath();
        ctx.fill();
      } else if (template.style === 'orange-ribbon') {
        ctx.fillStyle = '#F97316';
        ctx.fillRect(bgX, bgY, bgWidth, bgHeight);
      } else if (template.style === 'red-ribbon') {
        ctx.fillStyle = '#EF4444';
        ctx.fillRect(bgX, bgY, bgWidth, bgHeight);
      } else if (template.style === 'history-lines') {
        ctx.strokeStyle = '#EAB308';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(bgX, bgY - 10);
        ctx.lineTo(bgX + bgWidth, bgY - 10);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(bgX, bgY + bgHeight + 10);
        ctx.lineTo(bgX + bgWidth, bgY + bgHeight + 10);
        ctx.stroke();
      } else if (template.style === 'diamond' || template.style === 'ocean') {
        // Glassmorphism effect
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(bgX, bgY, bgWidth, bgHeight);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 2;
        ctx.strokeRect(bgX, bgY, bgWidth, bgHeight);
      } else {
        // Default minimal background
        if (template.style !== 'minimal') {
          ctx.fillRect(bgX, bgY, bgWidth, bgHeight);
        }
      }
      ctx.restore();

      // Draw title text
      ctx.fillStyle = '#FFFFFF';
      if (template.style === 'diamond') ctx.fillStyle = '#3B82F6';
      if (template.style === 'ocean') ctx.fillStyle = '#06B6D4';
      if (template.style === 'history-lines') ctx.fillStyle = '#EAB308';

      if (template.style === 'neon') {
        ctx.shadowColor = primaryColor;
        ctx.shadowBlur = 10;
      }
      
      // Draw icon for specific templates
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 10;
      if (template.style === 'ocean') {
        ctx.font = '70px Arial';
        ctx.fillText('🤿', xPos - textWidth / 2 - 80, currentY);
      }
      if (template.style === 'red-ribbon') {
        ctx.font = '70px Arial';
        ctx.fillText('🚀', xPos - textWidth / 2 - 80, currentY);
      }
      ctx.restore();

      ctx.font = `900 80px ${template.font}`;
      ctx.fillText(line, xPos, currentY);

      // Draw icons below title
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 10;
      if (template.style === 'diamond') {
        ctx.font = '70px Arial';
        ctx.fillText('💎', xPos, currentY + 100);
      }
      if (template.style === 'orange-ribbon' || template.style === 'history-lines') {
        ctx.font = '70px Arial';
        ctx.fillText('📜', xPos, currentY + 100);
      }
      if (template.style === 'ocean') {
        ctx.font = '80px Arial';
        ctx.fillText('🦑', xPos, height - 100);
      }
      if (template.style === 'diamond') {
        ctx.font = '80px Arial';
        ctx.fillText('🚀', xPos, height - 100);
      }
      ctx.restore();
      currentY -= titleLineHeight;
    }
  }

  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outputPath, buffer);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // API routes
  app.get("/api/youtube", async (req, res) => {
    try {
      let query = req.query.url as string;
      if (!query) {
        return res.status(400).json({ error: "URL or query is required" });
      }

      console.log(`[API] Processing: ${query}`);

      // 1. Direct Video Detection (watch?v=, youtu.be, shorts/)
      const extractVideoId = (url: string) => {
        const patterns = [
          /(?:v=|\/v\/|embed\/|youtu\.be\/|shorts\/|\/watch\?v=)([^#&?]*)/,
          /^[a-zA-Z0-9_-]{11}$/
        ];
        for (const pattern of patterns) {
          const match = url.match(pattern);
          if (match && match[1] && match[1].length === 11) return match[1];
          if (match && match[0] && match[0].length === 11) return match[0];
        }
        return null;
      };

      const videoId = extractVideoId(query);
      if (videoId) {
        console.log(`[Entry Engine] Direct Video ID: ${videoId}`);
        const video = await yts({ videoId });
        if (video) {
          return res.json({
            videos: [{
              id: video.videoId,
              title: video.title,
              views: video.views,
              duration: video.timestamp,
              thumbnail: video.thumbnail,
              url: video.url,
              author: video.author.name,
              seconds: video.seconds
            }],
            isDirect: true,
            isChannel: false,
            entryStatus: "SUCCESS",
            entryMethod: "DIRECT_ID_EXTRACTION"
          });
        }
      }

      // 2. Direct Channel Detection (@handle, /channel/, /c/, /user/)
      const isChannelUrl = query.includes('youtube.com/@') || 
                          query.includes('youtube.com/channel/') || 
                          query.includes('youtube.com/c/') ||
                          query.includes('youtube.com/user/');

      if (isChannelUrl) {
        console.log(`[Entry Engine] Direct Channel URL detected: ${query}`);
        
        // Extract handle or channel name for better searching
        let channelIdentifier = query;
        const handleMatch = query.match(/@([^/?\s]+)/);
        const channelIdMatch = query.match(/\/channel\/([^/?\s]+)/);
        
        if (handleMatch) {
          channelIdentifier = `@${handleMatch[1]}`;
        } else if (channelIdMatch) {
          channelIdentifier = channelIdMatch[1];
        }

        // Try multiple search targets to maximize shorts discovery
        const searchTargets = [
          `${channelIdentifier} shorts`,
          `${channelIdentifier} #shorts`,
          `site:youtube.com "${channelIdentifier}" shorts`
        ];

        let allVideos: any[] = [];
        for (const target of searchTargets) {
          try {
            console.log(`[Entry Engine] Searching for shorts via: ${target}`);
            const results = await yts(target);
            if (results && results.videos) {
              allVideos = [...allVideos, ...results.videos];
            }
          } catch (e) {
            console.error(`[Entry Engine] Search failed for target ${target}:`, e);
          }
        }

        // Deduplicate by video ID
        const uniqueVideos = Array.from(new Map(allVideos.map(v => [v.videoId, v])).values());

        // Strict filtering to ensure we only get videos from this channel if possible
        let filteredVideos = uniqueVideos;
        if (handleMatch) {
          const handle = handleMatch[1].toLowerCase();
          filteredVideos = uniqueVideos.filter(v => 
            v.author.name.toLowerCase().includes(handle) || 
            v.author.url.toLowerCase().includes(handle) ||
            v.title.toLowerCase().includes(handle)
          );
        }

        // Prioritize Shorts (duration <= 90s and/or "shorts" in title)
        const shorts = filteredVideos.filter(v => 
          v.seconds <= 90 || 
          v.title.toLowerCase().includes('shorts') ||
          v.url.includes('/shorts/')
        );

        // Sort by views or recency if available (yts doesn't give date easily, so views)
        const finalVideos = (shorts.length > 0 ? shorts : filteredVideos)
          .sort((a, b) => b.views - a.views)
          .slice(0, 25);

        console.log(`[Entry Engine] Found ${finalVideos.length} potential shorts for channel.`);

        return res.json({
          videos: finalVideos.map(v => ({
            id: v.videoId,
            title: v.title,
            views: v.views,
            duration: v.timestamp,
            thumbnail: v.thumbnail,
            url: v.url,
            author: v.author.name,
            seconds: v.seconds
          })),
          isDirect: false,
          isChannel: true,
          entryStatus: "SUCCESS",
          entryMethod: "CHANNEL_URL_ANALYSIS"
        });
      }

      // 3. Fallback to General Search (if not a direct URL)
      console.log(`[Entry Engine] General search for: ${query}`);
      const r = await yts(query);
      const searchVideos = r.videos.map((v: any) => ({
        id: v.videoId,
        title: v.title,
        views: v.views,
        duration: v.timestamp,
        thumbnail: v.thumbnail,
        url: v.url,
        author: v.author.name,
        seconds: v.seconds
      }));

      res.json({ 
        videos: searchVideos.slice(0, 15),
        isDirect: false,
        isChannel: false,
        entryStatus: "SUCCESS",
        entryMethod: "GENERAL_SEARCH_FALLBACK"
      });
    } catch (error) {
      console.error("YouTube search error:", error);
      res.status(500).json({ error: "Failed to fetch YouTube data" });
    }
  });

  // YouTube OAuth Setup
  const getYouTubeConfig = () => {
    try {
      if (fs.existsSync('youtube-config.json')) {
        return JSON.parse(fs.readFileSync('youtube-config.json', 'utf8'));
      }
    } catch (e) {
      console.error("Error reading youtube-config.json:", e);
    }
    return {
      clientId: process.env.YOUTUBE_CLIENT_ID,
      clientSecret: process.env.YOUTUBE_CLIENT_SECRET
    };
  };

  const getOAuth2Client = (redirectUri: string) => {
    const config = getYouTubeConfig();
    return new google.auth.OAuth2(
      config?.clientId,
      config?.clientSecret,
      redirectUri
    );
  };

  const getRedirectUri = (req: express.Request) => {
    // Use APP_URL from environment if available (recommended for AI Studio)
    if (process.env.APP_URL) {
      return `${process.env.APP_URL.replace(/\/$/, '')}/api/auth/youtube/callback`;
    }
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    return `${protocol}://${host}/api/auth/youtube/callback`;
  };

  app.get('/api/auth/youtube/url', (req, res) => {
    const redirectUri = getRedirectUri(req);
    const config = getYouTubeConfig();
    
    if (!config?.clientId || !config?.clientSecret) {
      return res.status(500).json({ error: "YouTube Client ID or Secret not configured." });
    }

    const oauth2Client = getOAuth2Client(redirectUri);
    
    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/youtube.upload',
        'https://www.googleapis.com/auth/youtube.readonly'
      ],
      prompt: 'consent select_account'
    });
    
    res.json({ url });
  });

  app.get('/api/auth/youtube/callback', async (req, res) => {
    const { code } = req.query;
    
    try {
      const redirectUri = getRedirectUri(req);
      
      const oauth2Client = getOAuth2Client(redirectUri);
      const { tokens } = await oauth2Client.getToken(code as string);
      oauth2Client.setCredentials(tokens);

      // Fetch channel info to use as ID
      const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
      const channelRes = await youtube.channels.list({
        part: ['snippet'],
        mine: true
      });

      if (channelRes.data.items && channelRes.data.items.length > 0) {
        const channel = channelRes.data.items[0];
        const channelId = channel.id;
        const channelInfo = {
          id: channelId,
          title: channel.snippet?.title,
          thumbnail: channel.snippet?.thumbnails?.default?.url
        };

        // Read existing tokens or create new object
        let allTokens: Record<string, any> = {};
        if (fs.existsSync('youtube-tokens.json')) {
          try {
            allTokens = JSON.parse(fs.readFileSync('youtube-tokens.json', 'utf8'));
            // Handle legacy format (if it's an array or just tokens object without channel keys)
            if (!allTokens[Object.keys(allTokens)[0]]?.tokens) {
              allTokens = {}; // Reset if legacy format
            }
          } catch (e) {
            allTokens = {};
          }
        }

        // Save tokens and channel info under channelId
        allTokens[channelId as string] = { tokens, channelInfo };
        fs.writeFileSync('youtube-tokens.json', JSON.stringify(allTokens, null, 2));
      }
      
      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'YOUTUBE_AUTH_SUCCESS' }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>تم الربط بنجاح! سيتم إغلاق هذه النافذة تلقائياً.</p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("Error exchanging code for tokens:", error);
      res.status(500).send("فشل في استخراج التوكن. يرجى المحاولة مرة أخرى.");
    }
  });

  app.get('/api/auth/youtube/status', (req, res) => {
    let channels: any[] = [];
    let isConnected = false;

    if (fs.existsSync('youtube-tokens.json')) {
      try {
        const allTokens = JSON.parse(fs.readFileSync('youtube-tokens.json', 'utf8'));
        channels = Object.values(allTokens).map((t: any) => t.channelInfo).filter(Boolean);
        isConnected = channels.length > 0;
      } catch (e) {
        console.error("Error reading tokens status:", e);
      }
    }

    const config = getYouTubeConfig();
    res.json({ 
      connected: isConnected,
      channels,
      configSet: !!(config?.clientId && config?.clientSecret),
      clientId: config?.clientId || ""
    });
  });

  app.post('/api/auth/youtube/config', (req, res) => {
    const { clientId, clientSecret } = req.body;
    if (!clientId || !clientSecret) {
      return res.status(400).json({ error: "Client ID and Secret are required" });
    }

    // Basic validation for Google Client ID
    if (!clientId.endsWith('.apps.googleusercontent.com')) {
      return res.status(400).json({ error: "Client ID غير صالح. يجب أن ينتهي بـ .apps.googleusercontent.com" });
    }

    if (!clientSecret.startsWith('GOCSPX-')) {
      return res.status(400).json({ error: "Client Secret غير صالح. يجب أن يبدأ بـ GOCSPX-" });
    }
    
    fs.writeFileSync('youtube-config.json', JSON.stringify({ clientId, clientSecret }, null, 2));
    res.json({ success: true });
  });

  app.post('/api/auth/youtube/disconnect', (req, res) => {
    const { channelId } = req.body;
    if (fs.existsSync('youtube-tokens.json')) {
      if (channelId) {
        try {
          const allTokens = JSON.parse(fs.readFileSync('youtube-tokens.json', 'utf8'));
          delete allTokens[channelId];
          fs.writeFileSync('youtube-tokens.json', JSON.stringify(allTokens, null, 2));
        } catch (e) {
          console.error("Error disconnecting channel:", e);
        }
      } else {
        fs.unlinkSync('youtube-tokens.json'); // Disconnect all
      }
    }
    res.json({ success: true });
  });

  app.get('/api/auth/youtube/verify-token', async (req, res) => {
    if (!fs.existsSync('youtube-tokens.json')) {
      return res.json({ valid: false, error: "لم يتم العثور على توكن" });
    }

    try {
      const allTokens = JSON.parse(fs.readFileSync('youtube-tokens.json', 'utf8'));
      const channels = [];

      const redirectUri = getRedirectUri(req);
      
      for (const [channelId, data] of Object.entries(allTokens)) {
        const { tokens, channelInfo } = data as any;
        const oauth2Client = getOAuth2Client(redirectUri);
        oauth2Client.setCredentials(tokens);

        const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
        try {
          const channelRes = await youtube.channels.list({
            part: ['snippet'],
            mine: true
          });

          if (channelRes.data.items && channelRes.data.items.length > 0) {
             channels.push({
               id: channelId,
               title: channelRes.data.items[0].snippet?.title,
               thumbnail: channelRes.data.items[0].snippet?.thumbnails?.default?.url
             });
          }
        } catch (e) {
          console.error(`Token verification failed for channel ${channelId}:`, e);
          // Token might be expired/revoked, we could remove it here but let's keep it simple
        }
      }

      if (channels.length > 0) {
        res.json({ valid: true, channels });
      } else {
        res.json({ valid: false, error: "لم يتم العثور على قنوات صالحة" });
      }
    } catch (error: any) {
      console.error("Token verification error:", error);
      res.json({ valid: false, error: error.message || "فشل التحقق من التوكن" });
    }
  });

  app.get('/api/geminigen/history', async (req, res) => {
    try {
      const { page = 1, filter_by = 'all', items_per_page = 20 } = req.query;
      const response = await axios.get(`https://api.geminigen.ai/uapi/v1/histories`, {
        params: { page, filter_by, items_per_page },
        headers: {
          'x-api-key': 'geminiai-e098b97aa16085449c3eb4ad77b35142'
        }
      });
      res.json(response.data);
    } catch (error: any) {
      console.error('Error proxying geminigen history:', error.message);
      res.status(500).json({ error: 'Failed to fetch history', details: error.message });
    }
  });

  app.get('/api/proxy-download', async (req, res) => {
      const { url, filename, apiKey, overlayText, audioUrl, templateId } = req.query;
      if (!url) return res.status(400).send('URL is required');

      try {
        console.log(`[Proxy] Downloading: ${url}`);
        const headers: Record<string, string> = {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': '*/*',
        };

        if ((url as string).includes('generativelanguage.googleapis.com')) {
          if (apiKey) {
            headers['x-goog-api-key'] = apiKey as string;
          } else if (process.env.GEMINI_API_KEY) {
            headers['x-goog-api-key'] = process.env.GEMINI_API_KEY;
          } else if (process.env.API_KEY) {
            headers['x-goog-api-key'] = process.env.API_KEY;
          }
        }

        const response = await axios({
          method: 'GET',
          url: url as string,
          responseType: 'stream',
          headers: headers,
          timeout: 30000, // 30 seconds timeout
        });

        if (overlayText || audioUrl) {
          console.log(`[Proxy] Processing video with overlay text or audio...`);
          const tempVideoPath = path.join(os.tmpdir(), `proxy-${Date.now()}.mp4`);
          const tempAudioPath = path.join(os.tmpdir(), `proxy-audio-${Date.now()}.mp3`);
          const overlayImagePath = path.join(os.tmpdir(), `proxy-overlay-${Date.now()}.png`);
          const processedVideoPath = path.join(os.tmpdir(), `proxy-processed-${Date.now()}.mp4`);

          const writer = fs.createWriteStream(tempVideoPath);
          response.data.pipe(writer);

          await new Promise<void>((resolve, reject) => {
            writer.on('finish', () => resolve());
            writer.on('error', (err) => reject(err));
          });

          try {
            let command = ffmpeg(tempVideoPath);
            
            if (audioUrl) {
              const audioResponse = await axios({
                method: 'GET',
                url: audioUrl as string,
                responseType: 'stream',
                timeout: 30000,
              });
              const audioWriter = fs.createWriteStream(tempAudioPath);
              audioResponse.data.pipe(audioWriter);
              await new Promise<void>((resolve, reject) => {
                audioWriter.on('finish', () => resolve());
                audioWriter.on('error', (err) => reject(err));
              });
              command = command.input(tempAudioPath);
            }

            if (overlayText) {
              await generateOverlayImage(overlayText as string, overlayImagePath, templateId as string);
            }

            // Fix the input index for overlay if audio is present
            let outputOptions = ['-c:v libx264', '-preset fast', '-crf 23', '-t 8', '-pix_fmt yuv420p'];
            
            if (overlayText && audioUrl) {
              // 0: video, 1: audio, 2: image
              command = command.input(overlayImagePath).inputOptions(['-loop 1']);
              command = command.complexFilter([
                '[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920[bg]',
                '[bg][2:v]overlay=0:0[outv]'
              ]);
              outputOptions.push('-map', '[outv]', '-map', '1:a', '-c:a', 'aac');
            } else if (overlayText && !audioUrl) {
              command = command.input(overlayImagePath).inputOptions(['-loop 1']);
              command = command.complexFilter([
                '[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920[bg]',
                '[bg][1:v]overlay=0:0[outv]'
              ]);
              outputOptions.push('-map', '[outv]', '-map', '0:a?');
            } else if (!overlayText && audioUrl) {
              command = command.complexFilter([
                '[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920[outv]'
              ]);
              outputOptions.push('-map', '[outv]', '-map', '1:a', '-c:a', 'aac');
            }

            await new Promise<void>((resolve, reject) => {
              command
                .outputOptions(outputOptions)
                .save(processedVideoPath)
                .on('end', () => resolve())
                .on('error', (err, stdout, stderr) => reject(new Error(`${err.message} - ${stderr}`)));
            });

            res.setHeader('Content-Type', 'video/mp4');
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename as string || 'video.mp4')}"`);
            
            const readStream = fs.createReadStream(processedVideoPath);
            readStream.pipe(res);
            
            readStream.on('close', () => {
              if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
              if (fs.existsSync(tempAudioPath)) fs.unlinkSync(tempAudioPath);
              if (fs.existsSync(overlayImagePath)) fs.unlinkSync(overlayImagePath);
              if (fs.existsSync(processedVideoPath)) fs.unlinkSync(processedVideoPath);
            });
            return;
          } catch (err) {
            console.error('[Proxy] Video processing failed, sending original:', err);
            if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
            if (fs.existsSync(tempAudioPath)) fs.unlinkSync(tempAudioPath);
            if (fs.existsSync(overlayImagePath)) fs.unlinkSync(overlayImagePath);
            if (fs.existsSync(processedVideoPath)) fs.unlinkSync(processedVideoPath);
            throw new Error(`Video processing failed: ${err.message} - ${err.stderr || 'No stderr'}`);
          }
        }

      res.setHeader('Content-Type', response.headers['content-type'] || 'video/mp4');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename as string || 'video.mp4')}"`);
      response.data.pipe(res);
    } catch (error: any) {
      console.error('[Proxy] Download failed:', error.message);
      res.status(500).json({ error: 'Failed to download video', details: error.message });
    }
  });

  app.post('/api/youtube/schedule', async (req, res) => {
    const { videoId, videoUrl, title, description, overlayText, audioUrl, templateId, scheduledTime, channelId, publishNow, apiKey } = req.body;
    
    // 1. Pre-upload verification
    if (!videoId || !videoUrl || !channelId) {
      console.error(`[Verification Failed] Missing required data. VideoId: ${videoId}, URL: ${videoUrl}, Channel: ${channelId}`);
      return res.status(400).json({ error: "بيانات التحقق مفقودة (معرف الفيديو، الرابط، أو القناة)" });
    }

    console.log(`[Verification Passed] Starting upload for Video ID: ${videoId} to Channel: ${channelId}`);

    if (!fs.existsSync('youtube-tokens.json')) {
      return res.status(401).json({ error: "YouTube account not connected" });
    }

    try {
      const allTokens = JSON.parse(fs.readFileSync('youtube-tokens.json', 'utf8'));
      
      // If channelId is provided, use it. Otherwise, fallback to the first available channel (legacy support)
      const channelData = channelId ? allTokens[channelId] : Object.values(allTokens)[0];

      if (!channelData || !channelData.tokens) {
        return res.status(401).json({ error: "Invalid channel or token not found" });
      }

      const tokens = channelData.tokens;
      const redirectUri = getRedirectUri(req);
      const oauth2Client = getOAuth2Client(redirectUri);
      oauth2Client.setCredentials(tokens);

      const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

      console.log(`[YouTube] Attempting to download: ${videoUrl}`);

      if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
        console.error(`[YouTube] Error: Cannot download from YouTube URL: ${videoUrl}`);
        throw new Error("Cannot download from YouTube URL. Please provide a direct video file URL.");
      }

      // Download the video
      const isImageBackground = videoUrl.toLowerCase().endsWith('.jpg') || videoUrl.toLowerCase().endsWith('.png') || videoUrl.toLowerCase().endsWith('.jpeg');
      const fileExtension = isImageBackground ? videoUrl.split('.').pop() : 'mp4';
      const tempVideoPath = path.join(os.tmpdir(), `video-${Date.now()}.${fileExtension}`);
      try {
        const headers: Record<string, string> = {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'video/webm,video/ogg,video/*;q=0.9,application/ogg;q=0.7,audio/*;q=0.6,*/*;q=0.5',
          'Accept-Language': 'en-US,en;q=0.9',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
        };

        if (videoUrl.includes('vimeo.com')) {
          headers['Referer'] = 'https://vimeo.com/';
        } else if (videoUrl.includes('mixkit.co')) {
          headers['Referer'] = 'https://mixkit.co/';
        } else if (videoUrl.includes('generativelanguage.googleapis.com')) {
          if (apiKey) {
            headers['x-goog-api-key'] = apiKey;
          } else if (process.env.GEMINI_API_KEY) {
            headers['x-goog-api-key'] = process.env.GEMINI_API_KEY;
          } else if (process.env.API_KEY) {
            headers['x-goog-api-key'] = process.env.API_KEY;
          }
        }

        const response = await axios({
          method: 'GET',
          url: videoUrl,
          responseType: 'stream',
          headers: headers,
          timeout: 60000, // 60 seconds timeout
        });

        const writer = fs.createWriteStream(tempVideoPath);
        response.data.pipe(writer);

        await new Promise<void>((resolve, reject) => {
          writer.on('finish', () => resolve());
          writer.on('error', (err) => reject(err));
        });
      } catch (error: any) {
        console.error(`[YouTube] Download failed for ${videoUrl}:`, error.message);
        throw new Error(`Failed to download video from ${videoUrl}: ${error.message}`);
      }

      let finalVideoPath = tempVideoPath;
      let overlayImagePath: string | null = null;
      let tempAudioPath: string | null = null;

      if (overlayText || audioUrl || isImageBackground) {
        console.log(`[YouTube] Processing video with overlay text, audio, or image background...`);
        try {
          const processedVideoPath = path.join(os.tmpdir(), `processed-${Date.now()}.mp4`);
          let command = ffmpeg();
          
          if (isImageBackground) {
            command = command.input(tempVideoPath).inputOptions(['-loop 1', '-framerate 30']);
          } else {
            command = command.input(tempVideoPath);
          }
          
          if (audioUrl) {
            tempAudioPath = path.join(os.tmpdir(), `audio-${Date.now()}.mp3`);
            const audioResponse = await axios({
              method: 'GET',
              url: audioUrl,
              responseType: 'stream',
              timeout: 30000,
            });
            const audioWriter = fs.createWriteStream(tempAudioPath);
            audioResponse.data.pipe(audioWriter);
            await new Promise<void>((resolve, reject) => {
              audioWriter.on('finish', () => resolve());
              audioWriter.on('error', (err) => reject(err));
            });
            command = command.input(tempAudioPath);
          }

          if (overlayText) {
            overlayImagePath = path.join(os.tmpdir(), `overlay-${Date.now()}.png`);
            await generateOverlayImage(overlayText, overlayImagePath, templateId);
            command = command.input(overlayImagePath).inputOptions(['-loop 1']);
          }

          let outputOptions = ['-c:v libx264', '-preset fast', '-crf 23', '-t 8', '-pix_fmt yuv420p'];
          
          let filterString = '[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920[bg]';
          
          if (overlayText) {
            // If audio is present, overlay is input 2, else input 1
            const overlayInputIndex = audioUrl ? 2 : 1;
            filterString += `;[bg][${overlayInputIndex}:v]overlay=0:0[outv]`;
          }

          command = command.complexFilter(filterString);
          
          outputOptions.push('-map', overlayText ? '[outv]' : '[bg]');
          if (audioUrl) {
            outputOptions.push('-map', '1:a', '-c:a', 'aac');
          } else if (!isImageBackground) {
            outputOptions.push('-map', '0:a?');
          }

          await new Promise<void>((resolve, reject) => {
            command
              .outputOptions(outputOptions)
              .save(processedVideoPath)
              .on('end', () => {
                console.log('[YouTube] Video processing finished.');
                resolve();
              })
              .on('error', (err, stdout, stderr) => {
                console.error('[YouTube] Video processing error:', err, stderr);
                reject(new Error(`${err.message} - ${stderr}`));
              });
          });

          finalVideoPath = processedVideoPath;
        } catch (err: any) {
          console.error('[YouTube] Failed to process video:', err);
          throw new Error(`فشل في معالجة الفيديو: ${err.message}`);
        }
      }

      // Upload to YouTube
      const uploadResponse = await youtube.videos.insert({
        part: ['snippet', 'status'],
        requestBody: {
          snippet: {
            title,
            description,
            categoryId: '22', // People & Blogs
          },
          status: {
            privacyStatus: publishNow ? 'public' : 'private',
            publishAt: publishNow ? undefined : (scheduledTime ? new Date(scheduledTime).toISOString() : undefined),
            selfDeclaredMadeForKids: false,
          },
        },
        media: {
          body: fs.createReadStream(finalVideoPath),
        },
      });

      // Clean up
      if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
      if (finalVideoPath !== tempVideoPath && fs.existsSync(finalVideoPath)) fs.unlinkSync(finalVideoPath);
      if (overlayImagePath && fs.existsSync(overlayImagePath)) fs.unlinkSync(overlayImagePath);

      const youtubeUrl = `https://youtube.com/watch?v=${uploadResponse.data.id}`;

      res.json({ success: true, message: publishNow ? "تم نشر الفيديو بنجاح على يوتيوب" : "تمت جدولة الفيديو بنجاح على يوتيوب", youtubeUrl, videoId });
    } catch (error: any) {
      console.error("YouTube scheduling error:", error);
      let errorMessage = error.message || "فشل في جدولة الفيديو";
      if (error.response && error.response.data && error.response.data.error) {
        errorMessage = error.response.data.error.message || errorMessage;
      }
      res.status(500).json({ error: errorMessage });
    }
  });

  app.post('/api/video/render-long', async (req, res) => {
    try {
      const { scenes, topic } = req.body;
      if (!scenes || !Array.isArray(scenes) || scenes.length === 0) {
        return res.status(400).json({ error: "البيانات مفقودة" });
      }

      const sessionId = Date.now().toString();
      const tempDir = path.join(os.tmpdir(), `longvideo-${sessionId}`);
      fs.mkdirSync(tempDir, { recursive: true });

      console.log(`[LongVideo] Starting render for session ${sessionId} with ${scenes.length} scenes`);

      // Download background music
      const bgMusicUrl = 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=documentary-110525.mp3';
      const bgMusicPath = path.join(tempDir, `bgmusic-${sessionId}.mp3`);
      try {
        const response = await axios({ method: 'GET', url: bgMusicUrl, responseType: 'stream' });
        const writer = fs.createWriteStream(bgMusicPath);
        response.data.pipe(writer);
        await new Promise<void>((resolve, reject) => {
          writer.on('finish', () => resolve());
          writer.on('error', (err) => reject(err));
        });
      } catch (err) {
        console.error("Failed to download background music, proceeding without it", err);
        await new Promise<void>((resolve, reject) => {
          ffmpeg().input('anullsrc').inputFormat('lavfi').duration(60).save(bgMusicPath).on('end', resolve).on('error', reject);
        });
      }

      const sceneVideos: string[] = [];

      // Helper to create subtitle image
      const createSubtitleImage = (text: string, outputPath: string) => {
        const width = 1920;
        const height = 1080;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Dark gradient at bottom for readability
        const gradient = ctx.createLinearGradient(0, height - 250, 0, height);
        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(1, 'rgba(0,0,0,0.85)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, height - 250, width, 250);

        ctx.font = 'bold 55px Arial, Tahoma, sans-serif';
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 5;

        // Simple word wrap
        const words = text.split(' ');
        let line = '';
        const lines = [];
        const maxWidth = 1600;

        for (let n = 0; n < words.length; n++) {
          const testLine = line + words[n] + ' ';
          const metrics = ctx.measureText(testLine);
          if (metrics.width > maxWidth && n > 0) {
            lines.push(line);
            line = words[n] + ' ';
          } else {
            line = testLine;
          }
        }
        lines.push(line);

        let y = height - 150 - ((lines.length - 1) * 35);
        for (let i = 0; i < lines.length; i++) {
          ctx.strokeText(lines[i], width / 2, y);
          ctx.fillText(lines[i], width / 2, y);
          y += 70;
        }

        fs.writeFileSync(outputPath, canvas.toBuffer('image/png'));
      };

      // Process each scene
      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        const imgPath = path.join(tempDir, `img_${i}.jpg`);
        const audioPath = path.join(tempDir, `audio_${i}.mp3`);
        const subPath = path.join(tempDir, `sub_${i}.png`);
        const outPath = path.join(tempDir, `scene_${i}.mp4`);

        fs.writeFileSync(imgPath, Buffer.from(scene.image, 'base64'));
        fs.writeFileSync(audioPath, Buffer.from(scene.audio, 'base64'));
        createSubtitleImage(scene.text, subPath);

        // Render scene with Ken Burns and Subtitles
        await new Promise<void>((resolve, reject) => {
          ffmpeg()
            .input(imgPath)
            .input(subPath)
            .inputOptions(['-loop', '1', '-framerate', '30'])
            .input(audioPath)
            .complexFilter([
              // Zoompan effect (zoom in slowly)
              `[0:v]scale=1920:1080,zoompan=z='min(zoom+0.001,1.5)':d=9000:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':fps=30:s=1920x1080[bg]`,
              // Overlay subtitle
              `[bg][1:v]overlay=0:0:shortest=1[v]`
            ])
            .outputOptions([
              '-map', '[v]',
              '-map', '2:a',
              '-c:v', 'libx264',
              '-preset', 'fast',
              '-pix_fmt', 'yuv420p',
              '-c:a', 'aac',
              '-b:a', '192k',
              '-shortest'
            ])
            .save(outPath)
            .on('end', () => resolve())
            .on('error', (err, stdout, stderr) => {
              console.error(`[LongVideo] Error rendering scene ${i}:`, err, stderr);
              reject(new Error(`فشل في معالجة المشهد ${i + 1}`));
            });
        });

        sceneVideos.push(outPath);
      }

      // Concatenate all scenes
      const concatTxtPath = path.join(tempDir, 'concat.txt');
      const concatContent = sceneVideos.map(v => `file '${v}'`).join('\n');
      fs.writeFileSync(concatTxtPath, concatContent);

      const concatOutPath = path.join(tempDir, `concat_${sessionId}.mp4`);
      await new Promise<void>((resolve, reject) => {
        ffmpeg()
          .input(concatTxtPath)
          .inputOptions(['-f', 'concat', '-safe', '0'])
          .outputOptions(['-c', 'copy'])
          .save(concatOutPath)
          .on('end', () => resolve())
          .on('error', (err, stdout, stderr) => {
            console.error('[LongVideo] Error concatenating scenes:', err, stderr);
            reject(new Error('فشل في دمج المشاهد'));
          });
      });

      // Mix with background music
      const finalOutPath = path.join(tempDir, `final_${sessionId}.mp4`);
      await new Promise<void>((resolve, reject) => {
        ffmpeg()
          .input(concatOutPath)
          .input(bgMusicPath)
          .inputOptions(['-stream_loop', '-1'])
          .complexFilter([
            `[0:a]volume=1.0[a1];[1:a]volume=0.05[a2];[a1][a2]amix=inputs=2:duration=first:dropout_transition=2[a]`
          ])
          .outputOptions([
            '-map', '0:v',
            '-map', '[a]',
            '-c:v', 'copy',
            '-c:a', 'aac'
          ])
          .save(finalOutPath)
          .on('end', () => resolve())
          .on('error', (err, stdout, stderr) => {
            console.error('[LongVideo] Error mixing audio:', err, stderr);
            reject(new Error('فشل في إضافة الموسيقى'));
          });
      });

      // Move to public folder
      const videoFileName = `video-${sessionId}.mp4`;
      const publicVideoPath = path.join(process.cwd(), 'public', 'temp');
      if (!fs.existsSync(publicVideoPath)) {
        fs.mkdirSync(publicVideoPath, { recursive: true });
      }
      const finalDest = path.join(publicVideoPath, videoFileName);
      fs.copyFileSync(finalOutPath, finalDest);

      // Clean up
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (e) {
        console.error("Failed to clean up temp dir", e);
      }

      res.json({ videoUrl: `/temp/${videoFileName}` });

    } catch (error: any) {
      console.error('[LongVideo] Error:', error);
      res.status(500).json({ error: error.message || "فشل في إنشاء الفيديو الطويل" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
