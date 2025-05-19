// Script to update pricing values in Pricing.tsx
const fs = require('fs');
const path = require('path');

// Path to the Pricing.tsx file
const pricingFilePath = path.join(__dirname, 'src', 'pages', 'Pricing.tsx');

// Read the Pricing.tsx file
let pricingContent = fs.readFileSync(pricingFilePath, 'utf8');

// Current price values from the file
const currentPRICE_INFO = {
  'price_free': { monthly: 0, yearly: 0 },
  'price_pro': { monthly: 39.90, yearly: 418.80, annualMonthly: 34.90 },
  'price_business': { monthly: 69.90, yearly: 718.80, annualMonthly: 59.90 },
  'price_enterprise': { monthly: null, yearly: null, custom: true }
};

// New price values to set
// MODIFY THESE VALUES TO THE CORRECT PRICES
const newPRICE_INFO = {
  'price_free': { monthly: 0, yearly: 0 },
  'price_pro': { monthly: 29.90, yearly: 299.00, annualMonthly: 24.90 },        // Example new values
  'price_business': { monthly: 59.90, yearly: 599.00, annualMonthly: 49.90 },   // Example new values
  'price_enterprise': { monthly: null, yearly: null, custom: true }
};

// Create the new PRICE_INFO definition string
const newPRICE_INFO_string = `const PRICE_INFO = {
  'price_free': { monthly: ${newPRICE_INFO['price_free'].monthly}, yearly: ${newPRICE_INFO['price_free'].yearly} },
  'price_pro': { monthly: ${newPRICE_INFO['price_pro'].monthly}, yearly: ${newPRICE_INFO['price_pro'].yearly}, annualMonthly: ${newPRICE_INFO['price_pro'].annualMonthly} },
  'price_business': { monthly: ${newPRICE_INFO['price_business'].monthly}, yearly: ${newPRICE_INFO['price_business'].yearly}, annualMonthly: ${newPRICE_INFO['price_business'].annualMonthly} },
  'price_enterprise': { monthly: null, yearly: null, custom: true }
};`;

// Replace the PRICE_INFO constant in the file
const regex = /const PRICE_INFO = \{[^;]*\};/s;
pricingContent = pricingContent.replace(regex, newPRICE_INFO_string);

// Write the updated content back to the file
fs.writeFileSync(pricingFilePath, pricingContent, 'utf8');

console.log('Pricing values updated successfully!');
console.log('New values:');
console.log('Pro Plan: Monthly $' + newPRICE_INFO['price_pro'].monthly + ', Yearly $' + newPRICE_INFO['price_pro'].yearly);
console.log('Business Plan: Monthly $' + newPRICE_INFO['price_business'].monthly + ', Yearly $' + newPRICE_INFO['price_business'].yearly);
