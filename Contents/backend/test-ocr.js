/**
 * Quick OCR Test Script
 * Run this to verify Tesseract.js is working
 * Usage: node test-ocr.js
 */

const Tesseract = require('tesseract.js');

async function testOCR() {
  try {
    console.log('🔍 Testing Tesseract.js...\n');
    
    // Create a simple test image URL (a simple text image)
    const testImage = 'https://tesseract.projectnaptha.com/img/eng_bw.png';
    
    console.log('📸 Processing test image from:', testImage);
    console.log('⏳ This may take 10-30 seconds on first run (downloading language data)...\n');
    
    const result = await Tesseract.recognize(
      testImage,
      'eng',
      {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            process.stdout.write(`\r⏳ Progress: ${Math.round(m.progress * 100)}%`);
          }
        },
      }
    );
    
    console.log('\n\n✅ OCR SUCCESS!');
    console.log('📄 Extracted text:');
    console.log('─'.repeat(50));
    console.log(result.data.text);
    console.log('─'.repeat(50));
    console.log(`\n✨ Found ${result.data.text.length} characters`);
    console.log('🎉 Tesseract.js is working correctly!\n');
    
  } catch (error) {
    console.error('\n❌ OCR TEST FAILED:');
    console.error(error);
    console.error('\n💡 Fix: Run "npm install tesseract.js" in the backend folder');
  }
}

testOCR();
