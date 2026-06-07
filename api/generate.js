export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { type, prompt, orderId, paymentId, signature } = req.body;

  if (type === 'verify_payment') {
    const crypto = require('crypto');
    const secret = process.env.RAZORPAY_KEY_SECRET;
    const generated = crypto.createHmac('sha256', secret)
      .update(orderId + '|' + paymentId)
      .digest('hex');
    return res.status(200).json({ verified: generated === signature });
  }

  if (type === 'create_order') {
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
  }

  // Gemini AI
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 1000, temperature: 0.7 }
        })
      }
    );
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return res.status(200).json({ content: [{ type: 'text', text }] });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
