const express = require('express');
const path = require('path');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static frontend files
app.use(express.static(path.join(__dirname)));

// Root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// AI Chat Proxy Endpoint using native http/https request to avoid fetch dependency issues
app.post('/api/chat', async (req, res) => {
    try {
        const { message, history, model, apiKey } = req.body;
        const activeKey = apiKey || process.env.GEMINI_API_KEY;

        if (!activeKey) {
            return res.status(400).json({ error: 'API Key not configured. Please add your Gemini API Key in settings.' });
        }

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

        let modelName = 'gemini-1.5-flash';
        if (model === 'pro') modelName = 'gemini-1.5-pro';
        if (model === 'ultra') modelName = 'gemini-1.5-pro';

        const apiData = JSON.stringify({ contents });
        
        const apiReqOptions = {
            hostname: 'generativelanguage.googleapis.com',
            path: `/v1beta/models/${modelName}:generateContent?key=${activeKey}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(apiData)
            }
        };

        const apiReq = http.request('https://generativelanguage.googleapis.com' + apiReqOptions.path, {
            method: 'POST',
            headers: apiReqOptions.headers
        }, (apiRes) => {
            let data = '';
            apiRes.on('data', chunk => { data += chunk; });
            apiRes.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.candidates && parsed.candidates[0].content) {
                        res.json({ reply: parsed.candidates[0].content.parts[0].text });
                    } else if (parsed.error) {
                        res.status(400).json({ error: parsed.error.message });
                    } else {
                        res.status(500).json({ error: 'Unexpected response from Gemini API.' });
                    }
                } catch (e) {
                    res.status(500).json({ error: 'Failed to parse API response.' });
                }
            });
        });

        apiReq.on('error', (e) => {
            res.status(500).json({ error: e.message });
        });

        apiReq.write(apiData);
        apiReq.end();

    } catch (err) {
        console.error('Server error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Geniea AI server is running on port ${PORT}`);
});
