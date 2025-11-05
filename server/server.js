import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { HfInference } from '@huggingface/inference';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const HF_API_KEY = process.env.API_KEY;
if (!HF_API_KEY) {
  console.warn('Warning: API_KEY environment variable not set. Endpoints will return 503 until an API key is provided.');
}

const client = new HfInference(HF_API_KEY);

// Hugging Face models for image generation and text
// This is the official, standard SDXL model. It's the most likely 
// to be supported on the free, non-paid "HF Inference" provider.
const HF_IMAGE_MODEL = 'stabilityai/stable-diffusion-xl-base-1.0';
const HF_TEXT_MODEL = 'mistralai/Mistral-7B-Instruct-v0.1'; // Better text generation than gpt2

async function callHFImageAPI(prompt) {
  try {
    const imageBlob = await client.textToImage({
      model: HF_IMAGE_MODEL,
      inputs: prompt,
    });
    
    // Convert blob to base64 for JSON response
    const buffer = Buffer.from(await imageBlob.arrayBuffer());
    const base64 = buffer.toString('base64');
    
    // Determine mime type
    const mimeType = imageBlob.type || 'image/png';
    return `data:${mimeType};base64,${base64}`;
  } catch (err) {
    // Re-throw with proper status code inference
    const msg = err?.message || String(err);
    if (/401|unauthorized|invalid|authentication/i.test(msg)) {
      err.status = 401;
    } else if (/429|quota|rate limit|too many requests/i.test(msg)) {
      err.status = 429;
    } else if (/timeout|ECONNREFUSED|ENOTFOUND/i.test(msg)) {
      err.status = 502;
    } else {
      err.status = 500;
    }
    throw err;
  }
}

async function callHFTextAPI(systemInstruction, message) {
  try {
    const result = await client.chatCompletion({
      model: HF_TEXT_MODEL,
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: message },
      ],
      max_tokens: 256,
      temperature: 0.7,
    });
    
    return result.choices?.[0]?.message?.content || 'I understand. Let me help you with that.';
  } catch (err) {
    // Re-throw with proper status code inference
    const msg = err?.message || String(err);
    if (/401|unauthorized|invalid|authentication/i.test(msg)) {
      err.status = 401;
    } else if (/429|quota|rate limit|too many requests/i.test(msg)) {
      err.status = 429;
    } else if (/timeout|ECONNREFUSED|ENOTFOUND/i.test(msg)) {
      err.status = 502;
    } else {
      err.status = 500;
    }
    throw err;
  }
}


app.post('/api/generate-image', async (req, res) => {
  try {
    if (!HF_API_KEY) {
      return res.status(503).json({ error: 'Server not configured with Hugging Face API_KEY. Please set API_KEY in .env.' });
    }
    const { imageBase64, prompt, isRefinement = false } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'prompt is required' });
    }

    const fullPrompt = isRefinement
      ? prompt
      : `Transform this room into a ${prompt} interior design style. Keep the same room dimensions and layout. Update all furniture, colors, textures, decorations, and lighting to match the ${prompt} aesthetic. Make it look modern, cohesive, and professionally designed. Ensure the room looks inviting and well-coordinated.`;

    console.log(`Generating image with prompt: ${fullPrompt}`);
    const image = await callHFImageAPI(fullPrompt);
    res.json({ image });
  } catch (err) {
    console.error('generate-image error:', err);
    const msg = err?.message || String(err) || 'Unknown error';
    let status = 500;
    if (err?.status === 401 || /401|unauthoriz|invalid.*key/i.test(msg)) {
      status = 401;
    } else if (err?.status === 429 || /quota|rate limit|exceed/i.test(msg)) {
      status = 429;
    } else if (/ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT/i.test(msg)) {
      status = 502;
    }

    let retryAfterSeconds = null;
    try {
      const m = String(msg).match(/retry in\s*([0-9]+(?:\.[0-9]+)?)s/i);
      if (m) retryAfterSeconds = Math.ceil(parseFloat(m[1]));
    } catch (e) {}

    const payload = { error: msg };
    if (retryAfterSeconds != null) payload.retryAfterSeconds = retryAfterSeconds;
    if (retryAfterSeconds != null) res.set('Retry-After', String(retryAfterSeconds));
    res.status(status).json(payload);
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    if (!HF_API_KEY) {
      return res.status(503).json({ error: 'Server not configured with Hugging Face API_KEY. Please set API_KEY in .env.' });
    }
    const { style, message } = req.body;
    if (!message) return res.status(400).json({ error: 'message is required' });

    const systemInstruction = `You are an expert AI Interior Design Assistant specializing in the '${style}' aesthetic. 

INSTRUCTIONS:
1. If the user requests a visual change to the image (e.g., "make the sofa blue", "add more plants", "change the wall color"), respond ONLY with a JSON object:
   {"action": "edit_image", "prompt": "Transform the room by [detailed description of the user's modification]. Keep the overall layout but make these specific changes. Maintain the ${style} aesthetic."}

2. If the user asks questions, seeks advice, or requests product recommendations, respond conversationally as an expert designer.
   - Provide specific, actionable suggestions
   - Recommend products with realistic price ranges and where to find them
   - Explain WHY your suggestions work well for the ${style} style
   - Be concise but thorough

3. Always consider color harmony, lighting, proportions, and the overall ${style} aesthetic in your responses.`;

    const text = await callHFTextAPI(systemInstruction, message);
    res.json({ text });
  } catch (err) {
    console.error('chat error:', err);
    const msg = err?.message || String(err) || 'Unknown error';
    let status = 500;
    if (err?.status === 401 || /401|unauthoriz|invalid.*key/i.test(msg)) {
      status = 401;
    } else if (err?.status === 429 || /quota|rate limit|exceed/i.test(msg)) {
      status = 429;
    } else if (/ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT/i.test(msg)) {
      status = 502;
    }

    let retryAfterSeconds = null;
    try {
      if (Array.isArray(err?.details)) {
        for (const d of err.details) {
          if (d['@type'] && d['@type'].includes('RetryInfo') && d.retryDelay) {
            const m = String(d.retryDelay).match(/([0-9]+(?:\.[0-9]+)?)s/);
            if (m) retryAfterSeconds = Math.ceil(parseFloat(m[1]));
          }
        }
      }
      if (!retryAfterSeconds) {
        const m = String(msg).match(/retry in\s*([0-9]+(?:\.[0-9]+)?)s/i);
        if (m) retryAfterSeconds = Math.ceil(parseFloat(m[1]));
      }
    } catch (e) {}

    const payload = { error: msg };
    if (retryAfterSeconds != null) payload.retryAfterSeconds = retryAfterSeconds;
    if (retryAfterSeconds != null) res.set('Retry-After', String(retryAfterSeconds));
    res.status(status).json(payload);
  }
});

const port = process.env.PORT || 5000;
// Simple root and health endpoints to make the server easier to test in a browser
app.get('/', (req, res) => {
  res.type('html').send(`<h2>AI Interior Design API</h2>
    <p>Available endpoints:</p>
    <ul>
      <li>POST /api/generate-image</li>
      <li>POST /api/chat</li>
      <li>GET /health</li>
    </ul>
    <p>Frontend dev server usually runs at <a href=\"http://localhost:3000\">http://localhost:3000</a></p>`);
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', apiKeyConfigured: !!HF_API_KEY });
});
app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
