/**
 * AI Chat Route — Server-side proxy for OpenRouter API (free models).
 *
 * Creates a proxy endpoint POST /api/ai/chat that:
 * 1. Accepts { messages: [], context: {} } from the frontend
 * 2. Injects system context (available routes, features, page context)
 * 3. Forwards to OpenRouter's free model endpoint
 * 4. Returns the AI response
 *
 * This keeps the OPENROUTER_API_KEY server-side only.
 * Uses the `openrouter/free` meta-model that auto-selects the best
 * available free model (Google Gemini Flash, Llama, Qwen, etc.).
 */

const express = require('express');
const pool = require('../db/pool');
const metricsCollector = require('../services/MetricsCollector');

const router = express.Router();

/**
 * Build a system prompt with database context injected as JSON.
 * This gives Claude awareness of current available routes and platform features.
 */
async function buildSystemPrompt(userContext = {}) {
  // Get current available routes for context
  const today = new Date().toISOString().split('T')[0];
  const routesResult = await pool.query(
    `SELECT r.id, r.departure_time, r.arrival_time, r.duration_minutes, r.fare, r.travel_date,
            oc.name AS origin_city, dc.name AS destination_city,
            b.name AS bus_name, b.type AS bus_type, b.amenities,
            (SELECT COUNT(*) FROM seats s WHERE s.route_id = r.id AND s.status = 'available') AS available_seats
     FROM routes r
     JOIN cities oc ON r.origin_city_id = oc.id
     JOIN cities dc ON r.destination_city_id = dc.id
     JOIN buses b ON r.bus_id = b.id
     WHERE r.travel_date >= $1::date
       AND r.travel_date <= $1::date + INTERVAL '7 days'
     ORDER BY r.travel_date, r.departure_time
     LIMIT 20`,
    [today]
  );

  const systemPrompt = `You are the RapidRoute AI Assistant — a helpful travel booking assistant for an intercity bus booking platform called RapidRoute.

CURRENT DATABASE CONTEXT (available routes for the next 7 days):
${JSON.stringify(routesResult.rows, null, 2)}

RAPIDROUTE FEATURES:
- Search intercity bus routes by origin city, destination city, and travel date
- View real-time seat maps with color-coded availability (green=available, red=booked, yellow=held)
- Select seats with 10-minute hold timer
- Book tickets for multiple passengers
- Process payments with 95% success rate (simulated)
- Cancel bookings
- Rate limiter: max 5 booking attempts per minute per user
- Seat holds auto-expire after 10 minutes
- Idempotency keys prevent duplicate bookings on retry
- Routes operate between: Mumbai, Delhi, Bangalore, Hyderabad, Chennai, Pune, Ahmedabad, Kolkata, Jaipur, Kochi
- Bus types: Sleeper (lower/upper deck), Semi-Sleeper, Seater

PAGE CONTEXT:
${JSON.stringify(userContext, null, 2)}

CAPABILITIES:
1. NATURAL LANGUAGE SEARCH: Users can describe seat preferences (window/aisle, lower/upper deck) and you can recommend specific seats based on available data
2. ROUTE SUGGESTIONS: Users can ask "I want to go from X to Y" and you can tell them what routes are available, fares, bus types, etc.
3. BOOKING HELP: Explain how the booking process works, what happens if they don't complete payment, how holds work, etc.
4. GENERAL INFO: Answer questions about RapidRoute features, concurrency patterns, how the platform works

Guidelines:
- Be concise and helpful
- When suggesting routes, reference actual data from the context above
- For seat selection, explain the visual seat map system
- Format responses with clear sections for readability
- If asked about something outside your capabilities, politely explain what you can help with`;
  return systemPrompt;
}

/**
 * POST /api/ai/chat
 * Proxy to Anthropic Claude API.
 */
router.post('/chat', async (req, res) => {
  const startTime = Date.now();

  try {
    const { messages, context } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey || apiKey === 'your_openrouter_api_key_here' || apiKey === 'your_anthropic_api_key_here') {
      return res.status(200).json({
        role: 'assistant',
        content: `I'm configured to use **OpenRouter** with free AI models, but **no API key has been set** yet.

Here's how to enable me:
1. Sign up at [OpenRouter](https://openrouter.ai) (free)
2. Generate an API key from your [dashboard](https://openrouter.ai/keys)
3. Add it to your \`.env\` file: \`OPENROUTER_API_KEY=sk-or-v1-...\`
4. Restart the server

> **No credit card needed** — OpenRouter's free tier gives you access to models like Gemini Flash, Llama, Qwen, and more!

In the meantime, here's what I can help with once enabled:

* **Find routes** — "Show me buses from Mumbai to Pune tomorrow"
* **Explain seat holds** — "What happens if I don't complete payment?"
* **Describe concurrency** — "How does optimistic locking work?"
* **Recommend features** — "What can I do on RapidRoute?"`,
      });
    }

    // Build system prompt with current context
    const systemPrompt = await buildSystemPrompt(context);

    // Prepare messages in OpenAI-compatible format (OpenRouter uses OpenAI API format)
    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    ];

    // Call OpenRouter API using the `openrouter/free` meta-model
    // This auto-selects the best available free model (Gemini Flash, Llama, Qwen, etc.)
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://rapidroute.app',
        'X-OpenRouter-Title': 'RapidRoute AI Assistant',
      },
      body: JSON.stringify({
        model: 'openrouter/free',
        max_tokens: parseInt(process.env.AI_MAX_TOKENS || '500', 10),
        messages: apiMessages,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('[AI] OpenRouter API error:', response.status, errorData);

      const responseTime = Date.now() - startTime;
      metricsCollector.recordAiQuery(responseTime, false);

      return res.status(response.status).json({
        error: 'AI request failed',
        detail: `OpenRouter API returned ${response.status}`,
      });
    }

    const data = await response.json();
    const responseTime = Date.now() - startTime;

    metricsCollector.recordAiQuery(responseTime, true);
    metricsCollector.recordConcurrencyEvent('ai.query', {
      messageCount: messages.length,
      responseTimeMs: responseTime,
    });

    // Extract content from OpenAI-compatible response format
    const replyContent = data.choices?.[0]?.message?.content || '';

    console.log(`[AI] Chat completed: ${messages.length} messages, ${responseTime}ms`);

    res.json({
      role: 'assistant',
      content: replyContent,
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    metricsCollector.recordAiQuery(responseTime, false);

    console.error('[AI] Chat error:', error.message);
    res.status(500).json({ error: 'AI chat failed', message: error.message });
  }
});

module.exports = router;
