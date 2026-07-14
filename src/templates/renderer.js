'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Loads a template from a file and replaces variables.
 * @param {string} templateName 
 * @param {object} vars 
 * @returns {string}
 */
function renderHtml(templateName, vars) {
  const filePath = path.join(__dirname, `${templateName}.html`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Template file not found: ${filePath}`);
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace {{variableName}}
  return content.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return vars[key] !== undefined ? vars[key] : match;
  });
}

module.exports = { renderHtml };
