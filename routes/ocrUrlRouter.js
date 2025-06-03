process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import express from 'express';
import fetch from 'node-fetch';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

const API_KEY = process.env.OCR_API_KEY;
const API_URL = process.env.OCR_API_URL;


function extractAndSortQuestions(textLines) {
  // same as your existing function
  const fullText = textLines.join("\n");
  const pattern = /(?:Q(?:uestion)?\s*)?(\d{1,2})[).:\-]?\s*(.*?)(?=(?:\n(?:Q(?:uestion)?\s*)?\d{1,2}[).:\-]?\s)|$)/gis;
  const matches = [...fullText.matchAll(pattern)];
  const sorted = matches
    .map(m => [parseInt(m[1]), m[2].trim()])
    .filter(([num, content]) => content.length > 0)
    .sort((a, b) => a[0] - b[0]);
  return sorted;
}

router.post('/ocr/url', async (req, res) => {
  try {
    const { imageUrl } = req.body;
    if (!imageUrl) {
      return res.status(400).json({ error: 'imageUrl is required' });
    }

    const payload = {
      model: "mistral-ocr-latest",
      id: uuidv4(),
      document: {
        url: imageUrl,
        type: "url"
      },
      include_image_base64: false,
      image_limit: 0,
      image_min_size: 0
    };

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OCR failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    const pages = result.pages || [];
    const lines = pages.flatMap(page => {
      return page.markdown.split("\n\n").map(line => line.trim()).filter(Boolean);
    });

    const questions = extractAndSortQuestions(lines);

    res.json({ message: 'OCR complete.', questions });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
