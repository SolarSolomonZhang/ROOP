const fs = require('fs');
const path = require('path');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const extensionRoot = path.join(__dirname, '..');
const manifestPath = path.join(extensionRoot, 'package.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

assert(manifest.contributes.languages.length > 0, 'No languages declared');
assert(fs.existsSync(path.join(extensionRoot, 'language-configuration.json')), 'Missing language configuration');
assert(fs.existsSync(path.join(extensionRoot, 'syntaxes', 'roop.tmLanguage.json')), 'Missing TextMate grammar');
assert(fs.existsSync(path.join(extensionRoot, 'extension.js')), 'Missing main extension entry');

console.log('VS Code extension smoke test passed.');
