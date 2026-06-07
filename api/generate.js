export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { type, prompt, orderId, paymentId, signature } = req.body;

  // Razorpay payment verification
  if (type === 'verify_payment') {
    const crypto = require('crypto');
    const secret = process.env.RAZORPAY_KEY_SECRET;
    const generated = crypto.createHmac('sha256', secret)
      .update(orderId + '|' + paymentId)
      .digest('hex');
    return res.status(200).json({ verified: generated === signature });
  }

  // Create Razorpay order
  if (type === 'create_order') {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    const credentials = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const orderRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${credentials}`
      },
      body: JSON.stringify({
        amount: 9900,
        currency: 'INR',
        receipt: 'resume_' + Date.now()
      })
    });
    const order = await orderRes.json();
    return res.status(200).json({ orderId: order.id, keyId });
  }

  // AI generation
  const API_KEY = process.env.ANTHROPIC_API_KEY;
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
