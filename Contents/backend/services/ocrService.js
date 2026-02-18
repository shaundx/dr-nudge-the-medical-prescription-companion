const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

/**
 * OCR Service — Extracts text from prescription images using Tesseract.js
 * Supports handwritten and printed prescriptions in multiple languages.
 */
const ocrService = {
  /**
   * Extract text from an image file
   * @param {string} imagePath - Path to the image file
   * @returns {Promise<string>} - Extracted text
   */
  async extractText(imagePath) {
    try {
      console.log(`[OCR] Processing image: ${imagePath}`);

      // Preprocess image first
      const processedPath = await this.preprocessImage(imagePath);

      const result = await Tesseract.recognize(processedPath, 'eng+hin', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            console.log(`[OCR] Progress: ${Math.round(m.progress * 100)}%`);
          }
        },
      });

      const text = result.data.text.trim();
      console.log(`[OCR] Extracted ${text.length} characters`);

      // Clean up processed image if different from original
      if (processedPath !== imagePath && fs.existsSync(processedPath)) {
        fs.unlinkSync(processedPath);
      }

      if (!text || text.length < 5) {
        return 'CLARIFICATION_NEEDED: Unable to read prescription clearly. The image may be too blurry or the handwriting is not legible.';
      }

      return text;
    } catch (error) {
      console.error('[OCR] Extraction failed:', error);
      throw new Error(`OCR failed: ${error.message}`);
    }
  },

  /**
   * REAL image preprocessing using Sharp library
   * Enhances image quality for better OCR accuracy
   */
  async preprocessImage(imagePath) {
    try {
      console.log('[OCR] Preprocessing image...');
      const outputPath = imagePath.replace(/\.(jpg|jpeg|png)$/i, '_processed.png');

      await sharp(imagePath)
        // Resize if too large (max 3000px width for performance)
        .resize(3000, 3000, {
          fit: 'inside',
          withoutEnlargement: true
        })
        // Convert to grayscale
        .grayscale()
        // Enhance contrast
        .normalize()
        // Sharpen slightly
        .sharpen()
        // Remove noise
        .median(3)
        // Increase brightness if too dark
        .modulate({ brightness: 1.1 })
        // Save as PNG for better quality
        .toFormat('png')
        .toFile(outputPath);

      console.log('[OCR] ✅ Image preprocessed successfully');
      return outputPath;
    } catch (error) {
      console.error('[OCR] Preprocessing failed, using original:', error.message);
      return imagePath; // Fallback to original if preprocessing fails
    }
  },
};

module.exports = ocrService;
