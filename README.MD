# Stealthwright

Stealthwright is a browser automation library with a Playwright-like API using the Chrome DevTools Protocol (CDP) for improved detection avoidance.

## Features

- **Playwright-compatible API**: Familiar syntax for easy migration from Playwright
- **Detection Avoidance**: Custom CDP implementation for better evasion of anti-bot measures
- **Human-like Interaction**: Simulate realistic typing with mistakes, natural pauses, and mouse movements
- **Proxy Support**: Built-in proxy rotation and authentication handling
- **Cookie Management**: Save and load cookies for session persistence
- **Headful/Headless Support**: Run with or without visible browser windows

## Installation

```bash
npm install stealthwright
```

## Quick Start

```javascript
const { stealthwright } = require('stealthwright');

(async () => {
  // Launch a browser
  const browser = await stealthwright().launch({
    headless: false,
  });
  
  // Create a browser context
  const context = browser.defaultBrowserContext();
  
  // Open a new page
  const page = await context.newPage();
  
  // Navigate to a URL
  await page.goto('https://example.com');
  
  // Take a screenshot
  await page.screenshot({ path: 'example.png' });
  
  // Close the browser
  await browser.close();
})();
```

## API Overview

Stealthwright mimics Playwright's API structure, so if you're familiar with Playwright, you'll feel right at home.

### Browser Management

```javascript
// Launch a browser
const browser = await stealthwright().launch({
  headless: false,                // Run in visible mode
  proxy: 'http://user:pass@host:port',  // Use a proxy
  startURL: 'https://example.com',      // Initial URL
  ignoreHTTPSErrors: true              // Ignore SSL errors
});

// Connect to an existing browser
const browser = await stealthwright().connect({
  wsEndpoint: 'ws://localhost:9222/devtools/browser/...'
});

// Close browser
await browser.close();
```

### Page Actions

```javascript
// Navigation
await page.goto('https://example.com');
await page.goBack();
await page.goForward();
await page.reload();

// Interaction
await page.click('#button');
await page.fill('#input', 'text');
await page.type('#input', 'text', { delay: 100 });
await page.typeWithMistakes('#input', 'text', { mistakeProbability: 0.2 });
await page.press('#input', 'Enter');
await page.setChecked('#checkbox', true);
await page.selectOption('#select', 'option1');
await page.hover('#element');

// Evaluation
const text = await page.textContent('#element');
const value = await page.evaluate(() => document.title);
const exists = await page.isVisible('#element');
```

### Locator Pattern

You can also use the locator pattern, which is helpful for repeated interactions with the same element:

```javascript
const inputField = page.locator('#input');
await inputField.fill('text');
await inputField.press('Enter');
const text = await inputField.textContent();
```

### Waiting

```javascript
// Wait for elements
await page.waitForSelector('#element');
await page.waitForSelector('#element', { state: 'visible' });

// Wait for navigation
await page.waitForNavigation();
await page.waitForNavigation({ waitUntil: 'networkidle0' });

// Wait for a specific condition
await page.waitForFunction(() => window.status === 'ready');

// Wait for a specific amount of time
await page.waitForTimeout(1000); // 1 second
```

### Screenshots and Content

```javascript
// Take a screenshot
await page.screenshot({ path: 'screenshot.png' });
await page.screenshot({ path: 'fullpage.png', fullPage: true });

// Get page content
const html = await page.content();
const title = await page.title();
```

### Cookies

```javascript
// Get all cookies
const cookies = await page.cookies();

// Set cookies
await page.setCookies([
  { name: 'cookie1', value: 'value1', domain: 'example.com', path: '/' }
]);

// Delete cookies
await page.deleteCookies();

// Save cookies to file
await page.saveCookies('cookies.json');

// Load cookies from file
await page.loadCookies('cookies.json');
```

## Advanced Features

### Human-like Typing

Stealthwright can simulate human typing with realistic mistakes:

```javascript
// Type with random mistakes that are corrected
await page.typeWithMistakes('#username', 'example@email.com', {
  delay: 100, // Time between keypresses in ms
  mistakeProbability: 0.3 // Probability of making a typing mistake
});
```

### Proxy Authentication

```javascript
const browser = await stealthwright().launch({
  proxy: 'http://username:password@proxy-host:port',
});
```

### Direct CDP Access

```javascript
// Execute CDP commands directly
const result = await page.cdp('Runtime.evaluate', {
  expression: 'document.title',
  returnByValue: true
});
```

## Browser Context

Browser contexts provide an isolated environment similar to incognito mode:

```javascript
// Create a browser context
const context = browser.defaultBrowserContext();

// Create a page in the context
const page = await context.newPage();

// Close the context when done
await context.close();
```

## Error Handling

```javascript
try {
  await page.click('#non-existent-element');
} catch (error) {
  if (error instanceof TimeoutError) {
    console.log('Element not found within timeout period');
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Examples

### Login to a Website

```javascript
const { stealthwright } = require('stealthwright');
const fs = require('fs');

(async () => {
  const browser = await stealthwright().launch({ headless: false });
  const context = browser.defaultBrowserContext();
  const page = await context.newPage();
  
  try {
    // Navigate to login page
    await page.goto('https://example.com/login');
    
    // Fill in the login form
    await page.fill('#username', 'user@example.com');
    await page.fill('#password', 'password123');
    
    // Click the login button
    await page.click('#login-button');
    
    // Wait for navigation
    await page.waitForNavigation();
    
    // Save cookies for future sessions
    await page.saveCookies('auth-cookies.json');
    
    console.log('Login successful!');
  } catch (error) {
    console.error('Login failed:', error);
  } finally {
    await browser.close();
  }
})();
```

### Scraping Data

```javascript
const { stealthwright } = require('stealthwright');
const fs = require('fs');

(async () => {
  const browser = await stealthwright().launch();
  const page = await browser.defaultBrowserContext().newPage();
  
  try {
    await page.goto('https://example.com/products');
    
    // Extract product information
    const products = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.product')).map(product => ({
        title: product.querySelector('.title').textContent,
        price: product.querySelector('.price').textContent,
        url: product.querySelector('a').href
      }));
    });
    
    // Save the data
    fs.writeFileSync('products.json', JSON.stringify(products, null, 2));
    console.log(`Scraped ${products.length} products`);
  } catch (error) {
    console.error('Scraping failed:', error);
  } finally {
    await browser.close();
  }
})();
```

## Comparison with Playwright

Stealthwright provides a similar API to Playwright but with enhanced detection avoidance:

```javascript
// Playwright:
const { chromium } = require('playwright');
const browser = await chromium.launch();

// stealthwright:
const { stealthwright } = require('stealthwright');
const browser = await stealthwright().launch();

// The rest of your code can remain almost identical
```

## License

MIT
