// Save as api/index.js
const crypto = require('crypto');

const ENCRYPTION_KEY = "X2h7nJ28tkfM4Yp9q1LdB3";

function encryptPayload(data, password) {
    const salt = crypto.randomBytes(8);
    const keyiv = crypto.pbkdf2Sync(password, salt, 10000, 48, 'sha256');
    const key = keyiv.slice(0, 32);
    const iv = keyiv.slice(32, 48);
    
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(data, 'utf8', 'binary');
    encrypted += cipher.final('binary');
    
    const encryptedBuffer = Buffer.from(encrypted, 'binary');
    const finalBuffer = Buffer.concat([
        Buffer.from('Salted__'),
        salt,
        encryptedBuffer
    ]);
    
    return finalBuffer.toString('base64');
}

async function sendMpokketOTP(phoneNumber) {
    try {
        const payloadData = {
            phoneNumber: phoneNumber,
            timestamp: Date.now(),
        };
        
        const jsonString = JSON.stringify(payloadData);
        const encryptedPayload = encryptPayload(jsonString, ENCRYPTION_KEY);
        
        const response = await fetch('https://web-api.mpokket.in/registration/sendOtp/sign-up', {
            method: 'POST',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Encoding': 'gzip, deflate, br, zstd',
                'Content-Type': 'application/json',
                'sec-ch-ua-platform': '"Windows"',
                'authorization': 'Bearer',
                'sec-ch-ua': '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
                'sec-ch-ua-mobile': '?0',
                'dnt': '1',
                'origin': 'https://web.mpokket.in',
                'sec-fetch-site': 'same-site',
                'sec-fetch-mode': 'cors',
                'sec-fetch-dest': 'empty',
                'referer': 'https://web.mpokket.in/',
                'accept-language': 'en-US,en;q=0.9,bn;q=0.8',
                'priority': 'u=1, i'
            },
            body: JSON.stringify({ payload: encryptedPayload })
        });
        
        const data = await response.json();
        
        return {
            success: response.ok,
            status: response.status,
            data: data,
            encryptedPayload: encryptedPayload
        };
        
    } catch (error) {
        return { success: false, error: error.message };
    }
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    if (req.method === 'GET') {
        return res.json({
            message: 'MPokket OTP API',
            endpoint: 'POST /api',
            body: { phone_number: '10-digit-number' }
        });
    }
    
    if (req.method === 'POST') {
        try {
            const body = JSON.parse(req.body || '{}');
            const { phone_number } = body;
            
            if (!phone_number || !/^\d{10}$/.test(phone_number)) {
                return res.status(400).json({
                    success: false,
                    error: 'Valid 10-digit phone number required'
                });
            }
            
            const result = await sendMpokketOTP(phone_number);
            
            return res.json({
                success: result.success,
                message: result.success ? 'OTP sent' : 'Failed to send OTP',
                data: result.data,
                encrypted: result.encryptedPayload
            });
            
        } catch (error) {
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
};
