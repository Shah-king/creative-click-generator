import express from 'express';
import cors from 'cors';
import Replicate from 'replicate';
import { writeFile } from 'fs/promises';
// Node 18+ includes global fetch; no need for node-fetch

const app = express();
app.use(cors());
app.use(express.json({ limit: '25mb' }));

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

app.post('/api/generate-video', async (req, res) => {
  try {
    const { prompt, imageUrl, durationSeconds } = req.body;
    if (!prompt) return res.status(400).json({ error: 'prompt required' });

    // Run the model
    const output = await replicate.run('google/veo-3-fast', {
      input: { prompt, image: imageUrl || null, duration: durationSeconds || 6 }
    });

    // output may be a URL or an object with a url method
    let videoUrl = null;
    if (typeof output === 'string') videoUrl = output;
    else if (output && typeof output.url === 'function') {
      videoUrl = output.url();
    } else if (output && output[0]) {
      videoUrl = output[0];
    }

    if (!videoUrl) return res.status(500).json({ error: 'No video URL returned' });

    // Fetch the video bytes (global fetch available in Node 18+)
    const f = await fetch(videoUrl);
    const arr = new Uint8Array(await f.arrayBuffer());

    // Write to disk (server-local)
    const outPath = `./tmp/output-${Date.now()}.mp4`;
    // ensure tmp directory exists
    try {
      await import('fs/promises').then(fs => fs.mkdir('./tmp', { recursive: true }));
    } catch (e) {
      // ignore mkdir errors
    }
    await writeFile(outPath, arr);

    // Respond with local path (for local testing) and original URL
    res.json({ videoUrl, localPath: outPath });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

const port = process.env.PORT || 4001;
app.listen(port, () => console.log(`API server listening on ${port}`));
