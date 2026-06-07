export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body;
  const type = body.type;
  const prompt = body.prompt;

  // Razorpay create order
  if (type === 'create_order') {
    try {
      const keyId = process.env.RAZORPAY_KEY_ID;
      const keySecret = process.env.RAZORPAY_KEY_SECRET;
      const credentials = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
      const orderRes = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${credentials}` },
        body: JSON.stringify({ amount: 9900, currency: 'INR', receipt: 'resume_' + Date.now() })
      });
      const order = await orderRes.json();
      return res.status(200).json({ orderId: order.id, keyId });
    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // Razorpay verify payment
  if (type === 'verify_payment') {
    try {
      const crypto = require('crypto');
      const secret = process.env.RAZORPAY_KEY_SECRET;
      const generated = crypto.createHmac('sha256', secret)
        .update(body.orderId + '|' + body.paymentId)
        .digest('hex');
      return res.status(200).json({ verified: generated === body.signature });
    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // Gemini AI
  try {
    const GEMINI_KEY = process.env.GEMINI_API_KEY;
    
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048
          }
        })
      }
    );

    const geminiData = await geminiRes.json();
    
    // Debug log
    console.log('Gemini response:', JSON.stringify(geminiData));

    // Extract text
    const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!text) {
      console.log('Empty text, full response:', JSON.stringify(geminiData));
      return res.status(200).json({ 
        content: [{ type: 'text', text: 'Error: Empty response from Gemini' }]
      });
    }

    return res.status(200).json({
      content: [{ type: 'text', text: text }]
    });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
