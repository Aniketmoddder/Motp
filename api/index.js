const crypto = require('crypto');

// Encryption key from the website
const ENCRYPTION_KEY = "X2h7nJ28tkfM4Yp9q1LdB3";

// Encrypt function matching the website
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

// Main handler
module.exports = async (req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Handle OPTIONS for CORS
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    // Handle GET request (show info)
    if (req.method === 'GET') {
        return res.json({
            message: '🎯 MPokket OTP API',
            status: 'Live',
            usage: 'POST /api/send-otp with {"phone_number": "10-digit-number"}',
            example: 'curl -X POST https://yourapp.vercel.app/api/send-otp -H "Content-Type: application/json" -d \'{"phone_number":"9876543210"}\''
        });
    }
    
    // Handle POST request
    if (req.method === 'POST') {
        try {
            let body;
            
            // Parse body (handle both string and object)
            if (typeof req.body === 'string') {
                body = JSON.parse(req.body);
            } else {
                body = req.body;
            }
            
            const { phone_number } = body;
            
            // Validate
            if (!phone_number) {
                return res.status(400).json({
                    success: false,
                    error: 'Phone number required',
                    example: { phone_number: '9876543210' }
                });
            }
            
            // Validate 10-digit number
            if (!/^\d{10}$/.test(phone_number)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid phone number. Must be 10 digits.'
                });
            }
            
            // Prepare payload
            const payloadData = {
                phoneNumber: phone_number,
                timestamp: Date.now(),
                deviceId: `web_${Date.now()}`,
                source: 'web'
            };
            
            // Encrypt
            const encrypted = encryptPayload(JSON.stringify(payloadData), ENCRYPTION_KEY);
            
            // Send to Mpokket
            const mpokketResponse = await fetch('https://web-api.mpokket.in/registration/sendOtp/sign-up', {
                method: 'POST',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'application/json, text/plain, */*',
                    'Content-Type': 'application/json',
                    'origin': 'https://web.mpokket.in',
                    'referer': 'https://web.mpokket.in/',
                    'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
                    'sec-ch-ua-mobile': '?0',
                    'sec-ch-ua-platform': '"Windows"'
                },
                body: JSON.stringify({ payload: encrypted })
            });
            
            const result = await mpokketResponse.json();
            
            // Return response
            return res.json({
                success: mpokketResponse.ok,
                status: mpokketResponse.status,
                message: mpokketResponse.ok ? 'OTP request sent' : 'Failed to send OTP',
                response: result,
                debug: {
                    phone: phone_number,
                    encrypted_length: encrypted.length,
                    timestamp: payloadData.timestamp
                }
            });
            
        } catch (error) {
            return res.status(500).json({
                success: false,
                error: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    }
    
    // Method not allowed
    return res.status(405).json({ 
        success: false, 
        error: 'Method not allowed. Use GET or POST.' 
    });
};
