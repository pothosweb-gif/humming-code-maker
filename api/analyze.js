module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { notes } = req.body;

    if (!notes || notes.length === 0) {
      return res.status(400).json({ error: 'Notes are required' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'API key not configured' });
    }

    const notesText = notes.join(' → ');
    const prompt = `You are a music theory expert. Given this melody note sequence:

${notesText}

Output ONLY a chord progression as a single line. No explanation, no analysis, no markdown.

Rules:
- Use standard chord names (C, Cm, Cmaj7, C7, etc.)
- Separate chords with " | "
- Output 4 to 8 chords
- Output the chord progression ONLY, nothing else

Example output:
G#m | C# | D# | F#

Chord progression:`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [
          { role: 'user', content: prompt }
        ]
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${errorBody}`);
    }

    const data = await response.json();
    const chordProgression = data.content[0].text.trim();

    return res.status(200).json({
      success: true,
      notes: notes,
      chords: chordProgression
    });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      error: 'Failed to analyze melody',
      message: error.message
    });
  }
}
