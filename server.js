const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON and serve static assets
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files from the current directory
app.use(express.static(path.join(__dirname)));

// Root route to serve your combined index.html file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// AI Chat Endpoint (Proxies to Gemini API securely)
app.post('/api/chat', async (req, res) => {
    try {
        const { message, history, model, apiKey } = req.body;
        const activeKey = apiKey || process.env.GEMINI_API_KEY;

        if (!activeKey) {
            return res.status(400).json({ error: 'API Key not configured. Please provide a Gemini API Key in settings or environment variables.' });
        }

        // Format conversation history for Gemini API
        let contents = [];
        if (history && Array.isArray(history)) {
            history.forEach(h => {
                contents.push({
                    role: h.role === 'user' ? 'user' : 'model',
                    parts: [{ text: h.text }]
                });
            });
        }
        contents.push({ role: 'user', parts: [{ text: message }] });

        // Select model name
        let modelName = 'gemini-1.5-flash';
        if (model === 'pro') modelName = 'gemini-1.5-pro';
        if (model === 'ultra') modelName = 'gemini-1.5-pro';

        const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
        const apiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${activeKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents })
        });

        const data = await apiResponse.json();
        
        if (data.candidates && data.candidates[0].content) {
            const reply = data.candidates[0].content.parts[0].text;
            res.json({ reply });
        } else if (data.error) {
            res.status(400).json({ error: data.error.message });
        } else {
            res.status(500).json({ error: 'Unexpected response structure from Gemini API.' });
        }

    } catch (err) {
        console.error('Server error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Geniea AI Server running on port ${PORT}`);
});
