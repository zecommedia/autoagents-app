// Script to generate app icons from logo
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sizes = [
  { size: 512, name: 'icon.png' },
  { size: 256, name: 'icon-256.png' },
  { size: 128, name: 'icon-128.png' },
  { size: 64, name: 'icon-64.png' },
  { size: 32, name: 'icon-32.png' },
  { size: 16, name: 'icon-16.png' }
];

async function generateIcons() {
  console.log('🎨 Generating app icons...');

  // Check if logo exists
  const logoPath = path.join(__dirname, '../public/logo-default.svg');
  if (!fs.existsSync(logoPath)) {
    console.error('❌ Logo not found at:', logoPath);
    console.log('Please place your logo at public/logo-default.svg');
    return;
  }

  // Create public directory if not exists
  const publicDir = path.join(__dirname, '../public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // Generate icons of different sizes
  for (const { size, name } of sizes) {
    try {
      const outputPath = path.join(publicDir, name);
      
      await sharp(logoPath)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toFile(outputPath);
      
      console.log(`✓ Generated ${name} (${size}x${size})`);
    } catch (error) {
      console.error(`❌ Error generating ${name}:`, error.message);
    }
  }

  console.log('✅ All icons generated successfully!');
  console.log('\nIcon files created in public/ directory:');
  sizes.forEach(({ name }) => console.log(`  - ${name}`));
  console.log('\nNow rebuild the app: npm run build:electron');
}

generateIcons().catch(console.error);
