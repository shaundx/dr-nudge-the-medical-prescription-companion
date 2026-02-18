const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function testVisionAPI() {
  console.log('🔍 Testing GPT-4 Vision API with prescription...\n');

  // You'll need to save your prescription image as 'test-prescription.jpg' in this folder
  const imagePath = path.join(__dirname, 'test-prescription.jpg');
  
  if (!fs.existsSync(imagePath)) {
    console.error('❌ Please save your prescription image as "test-prescription.jpg" in the backend folder');
    return;
  }

  try {
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');

    console.log('📤 Sending to GPT-4 Vision...\n');

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are Dr. Nudge, a Precision Adherence AI that analyzes prescription images.

Extract medication information from prescription images (handwritten or printed).

Return ONLY valid JSON with this exact structure:
{
  "drug_name": "Standardized drug name (e.g., Paracetamol, not Bioquic)",
  "dosage": "Amount + Unit (e.g., 500mg, 10ml)",
  "frequency": "Plain English (e.g., Every 4 hours, Twice Daily, As needed)",
  "duration": "e.g., 12 tablets, 7 days, 30 days",
  "route": "e.g., Oral, Topical, Injection",
  "instructions": "Any special instructions from prescription"
}

Important:
- Convert brand names to generic names when possible
- Make frequency human-readable (not medical abbreviations like q4h)
- If unclear or illegible, set drug_name to "CLARIFICATION_NEEDED"`,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extract all medication information from this prescription image:',
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
                detail: 'high',
              },
            },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 500,
    });

    const content = response.choices[0].message.content;
    console.log('✅ SUCCESS! Vision API Response:\n');
    console.log(content);
    console.log('\n');

    const json = JSON.parse(content.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
    console.log('📋 Parsed JSON:\n');
    console.log(JSON.stringify(json, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

testVisionAPI();
