const crypto = require('crypto');

// Encryption key
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

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    // Handle GET - show API info
    if (req.method === 'GET') {
        // Check if phone parameter is provided in GET
        if (req.query.phone) {
            const phone = req.query.phone;
            
            // Validate phone
            if (!/^\d{10}$/.test(phone)) {
                return res.json({
                    success: false,
                    error: 'Invalid phone. Must be 10 digits.'
                });
            }
            
            try {
                // Encrypt payload
                const payload = {
                    phoneNumber: phone,
                    timestamp: Date.now()
                };
                const encrypted = encryptPayload(JSON.stringify(payload), ENCRYPTION_KEY);
                
                return res.json({
                    success: true,
                    message: 'GET endpoint working',
                    phone: phone,
                    encrypted_payload: encrypted,
                    length: encrypted.length,
                    note: 'This is just showing the encrypted payload. Use POST to actually send OTP.'
                });
            } catch (error) {
                return res.json({ success: false, error: error.message });
            }
        }
        
        // No phone parameter - show info
        return res.json({
            message: '🎯 MPokket OTP API',
            status: 'Live',
            endpoints: {
                'GET /api/send-otp?phone=9876543210': 'Test encryption',
                'POST /api/send-otp': 'Send OTP (with JSON body)',
                'POST /api/send-otp?phone=9876543210': 'Send OTP (with query param)'
            },
            usage: {
                get: 'https://motp.vercel.app/api/send-otp?phone=9876543210',
                post_curl: 'curl -X POST https://motp.vercel.app/api/send-otp -H "Content-Type: application/json" -d \'{"phone_number":"9876543210"}\'',
                post_js: `fetch('https://motp.vercel.app/api/send-otp', {
  method: 'POST',
  headers: {'Content-Type':'application/json'},
  body: JSON.stringify({phone_number:'9876543210'})
})`
            }
        });
    }
    
    // Handle POST request
    if (req.method === 'POST') {
        try {
            let phone_number;
            
            // Parse phone from both body and query
            if (req.query.phone) {
                phone_number = req.query.phone;
            } else {
                let body = {};
                
                try {
                    if (req.body) {
                        if (typeof req.body === 'string') {
                            body = JSON.parse(req.body);
                        } else if (typeof req.body === 'object') {
                            body = req.body;
                        }
                    }
                } catch (e) {
                    console.log('Body parsing error:', e);
                }
                
                phone_number = body.phone_number || body.phone;
            }
            
            // Validate
            if (!phone_number) {
                return res.status(400).json({
                    success: false,
                    error: 'Phone number required. Use: ?phone=9876543210 or {"phone_number":"9876543210"}'
                });
            }
            
            if (!/^\d{10}$/.test(phone_number)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid phone. Must be 10 digits.'
                });
            }
            
            // Create payload
            const payload = {
                phoneNumber: phone_number,
                timestamp: Date.now(),
                deviceId: `web_${Date.now()}`,
                source: 'web'
            };
            
            const jsonString = JSON.stringify(payload);
            const encrypted = encryptPayload(jsonString, ENCRYPTION_KEY);
            
            console.log('Sending request to Mpokket with payload:', {
                phone: phone_number,
                payloadLength: encrypted.length
            });
            
            // Make request to Mpokket
            const response = await fetch('https://web-api.mpokket.in/registration/sendOtp/sign-up', {
                method: 'POST',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'application/json, text/plain, */*',
                    'Content-Type': 'application/json',
                    'origin': 'https://web.mpokket.in',
                    'referer': 'https://web.mpokket.in/',
                    'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
                    'sec-ch-ua-mobile': '?0',
                    'sec-ch-ua-platform': '"Windows"',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br'
                },
                body: JSON.stringify({ payload: encrypted })
            });
            
            // Get response as text first
            const responseText = await response.text();
            let responseData;
            
            try {
                responseData = JSON.parse(responseText);
            } catch (e) {
                // If it's not JSON, it's probably HTML
                console.log('Response is not JSON, might be HTML');
                console.log('First 500 chars:', responseText.substring(0, 500));
                
                // Check if it's an HTML error page
                if (responseText.includes('<!DOCTYPE') || responseText.includes('<html')) {
                    return res.json({
                        success: false,
                        error: 'MPokket returned HTML instead of JSON',
                        status: response.status,
                        hint: 'The request might be blocked or rejected',
                        response_preview: responseText.substring(0, 200)
                    });
                } else {
                    return res.json({
                        success: false,
                        error: 'Failed to parse response as JSON',
                        raw_response: responseText.substring(0, 500),
                        status: response.status
                    });
                }
            }
            
            // Return successful response
            return res.json({
                success: response.ok,
                status: response.status,
                message: response.ok ? 'OTP request processed' : 'Request failed',
                mpokket_response: responseData,
                debug: {
                    phone: phone_number,
                    encrypted_payload_length: encrypted.length,
                    request_body: { payload: encrypted }
                }
            });
            
        } catch (error) {
            console.error('API Error:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                stack: error.stack
            });
        }
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
};
