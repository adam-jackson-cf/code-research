const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');

router.post('/fetch-data', async (req, res) => {
    const url = req.body.url;
    
    try {
        const response = await fetch(url);
        const data = await response.text();
        
        res.json({ 
            success: true, 
            data: data,
            url: url 
        });
    } catch (error) {
        res.json({ 
            success: false, 
            error: error.message,
            url: url 
        });
    }
});

router.get('/external-api/:endpoint', async (req, res) => {
    const endpoint = req.params.endpoint;
    const baseUrl = req.query.base_url || 'http://api.example.com';
    const fullUrl = `${baseUrl}/${endpoint}`;
    
    try {
        const response = await fetch(fullUrl);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.json({ error: error.message });
    }
});

module.exports = router;