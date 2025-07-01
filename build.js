import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

// Generate manifest.json
const manifestTemplate = fs.readFileSync('manifest.template.json', 'utf8');
const manifest = manifestTemplate.replace('REPLACE_WITH_CLIENT_ID', process.env.CLIENT_ID);
fs.writeFileSync('public/manifest.json', manifest);

// Generate background.js with API key
const backgroundTemplate = fs.readFileSync('background.template.js', 'utf8');
const background = backgroundTemplate.replace('REPLACE_WITH_API_KEY', process.env.API_KEY);
fs.writeFileSync('public/background.js', background);

console.log('✅ manifest.json and background.js generated in public/ folder');