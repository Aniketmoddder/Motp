const crypto = require('crypto');

const ENCRYPTION_KEY = "AIzaSyCx80ru6-RXeTi3GvqkFsMVyMf-vpgIoVw";

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
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    // GET request - show info
    if (req.method === 'GET') {
        return res.json({
            message: '🎯 MPokket OTP API',
            status: 'Live',
            usage: {
                method: 'POST',
                url: 'https://motp.vercel.app/api/send-otp',
                body: '{"phone":"9876543210"} OR ?phone=9876543210'
            },
            test_links: [
                'https://motp.vercel.app/api/send-otp?phone=9876543210 (GET - test only)',
                'Use POST to actually send OTP'
            ]
        });
    }
    
    // POST request
    if (req.method === 'POST') {
        try {
            let phone;
            
            // Get phone from query or body
            if (req.query.phone) {
                phone = req.query.phone;
            } else {
                let body = {};
                if (req.body) {
                    try {
                        body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
                    } catch (e) {
                        body = {};
                    }
                }
                phone = body.phone || body.phone_number;
            }
            
            if (!phone || !/^\d{10}$/.test(phone)) {
                return res.status(400).json({
                    success: false,
                    error: 'Valid 10-digit phone number required'
                });
            }
            
            console.log(`Processing OTP request for: ${phone}`);
            
            // IMPORTANT: Create the EXACT payload structure
            // Based on typical Indian OTP APIs, it might need:
            const payloadData = {
                mobile: phone,
                phone: phone,
                mobileNumber: phone,
                countryCode: "91",
                phoneNumber: `+91${phone}`,
                timestamp: Date.now(),
                deviceId: `web-${Date.now()}`,
                source: "WEB",
                platform: "web",
                os: "Windows",
                browser: "Chrome",
                version: "120.0.0.0"
            };
            
            // Try different payload formats
            const payloadVariants = [
                JSON.stringify(payloadData),
                JSON.stringify({ mobile: phone, countryCode: "91" }),
                JSON.stringify({ phoneNumber: phone }),
                JSON.stringify({ mobileNumber: phone, source: "web" })
            ];
            
            let finalResponse = null;
            let successfulVariant = null;
            
            // Try each payload variant
            for (let i = 0; i < payloadVariants.length; i++) {
                const variant = payloadVariants[i];
                const encrypted = encryptPayload(variant, ENCRYPTION_KEY);
                
                console.log(`Trying variant ${i + 1}: ${variant.substring(0, 50)}...`);
                
                try {
                    const mpokketResponse = await fetch('https://web-api.mpokket.in/registration/sendOtp/sign-up', {
                        method: 'POST',
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                            'Accept': 'application/json, text/plain, */*',
                            'Accept-Language': 'en-US,en;q=0.9',
                            'Accept-Encoding': 'gzip, deflate, br',
                            'Content-Type': 'application/json',
                            'Origin': 'https://web.mpokket.in',
                            'Referer': 'https://web.mpokket.in/',
                            'Sec-Fetch-Dest': 'empty',
                            'Sec-Fetch-Mode': 'cors',
                            'Sec-Fetch-Site': 'same-site',
                            'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
                            'sec-ch-ua-mobile': '?0',
                            'sec-ch-ua-platform': '"Windows"',
                            'DNT': '1',
                            'Connection': 'keep-alive'
                        },
                        body: JSON.stringify({ payload: encrypted }),
                        // Add timeout
                        signal: AbortSignal.timeout(10000)
                    });
                    
                    const responseText = await mpokketResponse.text();
                    
                    if (mpokketResponse.ok) {
                        try {
                            const jsonResponse = JSON.parse(responseText);
                            finalResponse = {
                                success: true,
                                variant: i + 1,
                                response: jsonResponse,
                                status: mpokketResponse.status
                            };
                            successfulVariant = variant;
                            break;
                        } catch (e) {
                            // Not JSON but maybe successful
                            if (responseText.includes('success') || responseText.includes('OTP')) {
                                finalResponse = {
                                    success: true,
                                    variant: i + 1,
                                    raw_response: responseText.substring(0, 200),
                                    status: mpokketResponse.status
                                };
                                successfulVariant = variant;
                                break;
                            }
                        }
                    }
                    
                    // If we get HTML, skip
                    if (responseText.includes('<!DOCTYPE')) {
                        console.log(`Variant ${i + 1}: Got HTML response`);
                        continue;
                    }
                    
                } catch (error) {
                    console.log(`Variant ${i + 1} failed: ${error.message}`);
                    continue;
                }
            }
            
            if (finalResponse) {
                return res.json({
                    success: true,
                    message: 'OTP request sent successfully',
                    ...finalResponse,
                    debug: {
                        phone: phone,
                        successful_payload_format: successfulVariant,
                        note: 'If OTP not received, payload format might need adjustment'
                    }
                });
            } else {
                // If all variants fail, try a direct approach with minimal headers
                const minimalEncrypted = encryptPayload(JSON.stringify({ phoneNumber: phone }), ENCRYPTION_KEY);
                
                const directResponse = await fetch('https://web-api.mpokket.in/registration/sendOtp/sign-up', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    },
                    body: JSON.stringify({ payload: minimalEncrypted })
                });
                
                const directText = await directResponse.text();
                
                return res.json({
                    success: directResponse.ok,
                    status: directResponse.status,
                    response_preview: directText.substring(0, 300),
                    error: directResponse.ok ? null : 'All attempts failed',
                    debug_info: {
                        encrypted_sample: minimalEncrypted.substring(0, 50) + '...',
                        key_used: ENCRYPTION_KEY,
                        suggestion: 'Try capturing exact request from browser DevTools'
                    }
                });
            }
            
        } catch (error) {
            console.error('Error:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                help: 'The request is being blocked. This could be due to: 1) Wrong payload format, 2) IP blocking, 3) Missing headers'
            });
        }
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
};
