import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const filePath = resolve('public/script/game.js'); // Update with your file path
const fileContent = readFileSync(filePath, 'utf-8');

// Replace the specific line
const updatedContent = fileContent.replace(
  /import { naem } from "\.\/script";/,
  'import { naem } from "./script.js";'
);

// Write the updated content back to the file
writeFileSync(filePath, updatedContent, 'utf-8');
console.log('Line replaced successfully.');
