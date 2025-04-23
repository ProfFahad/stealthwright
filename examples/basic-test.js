/**
 * Stealthwright - Basic Test Example
 * 
 * This script demonstrates basic functionality of the Stealthwright library.
 * Run this file to test if the package works correctly.
 */

const { stealthwright } = require('../index');

// You can also use this if the package is installed via npm:
// const { stealthwright } = require('stealthwright');

(async () => {
  console.log('Starting Stealthwright test...');
  
  let browser;
  
  try {
    // Launch the browser
    console.log('Launching browser...');
    browser = await stealthwright().launch({
      headless: false, // Set to true for headless mode
      // Uncomment to use a proxy:
      // proxy: 'http://username:password@hostname:port'
    });
    
    console.log('Browser launched successfully');
    
    // Create a new page
    const context = browser.defaultBrowserContext();
    // Just create a new page - we'll work with this one
    const page = await context.newPage();
    
    // Navigate to a website
    console.log('Navigating to example.com...');
    await page.goto('https://example.com/', { waitUntil: 'load' });
    console.log('Navigation successful');
    
    // Get page title
    const title = await page.title();
    console.log(`Page title: ${title}`);
    
    // Take a screenshot
    console.log('Taking screenshot...');
    await page.screenshot({ path: 'example.png' });
    console.log('Screenshot saved to example.png');
    
    // Extract content from the page
    const heading = await page.locator('h1').textContent();
    console.log(`Heading content: ${heading}`);
    
    // Test typing in a search box (will navigate to another page first)
    console.log('Navigating to a page with search functionality...');
    await page.goto('https://duckduckgo.com/', { waitUntil: 'load' });
    console.log('Navigation successful');
    
    // Wait for the page to be fully loaded
    await page.waitForTimeout(1000);
    
    // Type with human-like behavior - use the correct selector
    console.log('Typing in search box...');
    await page.locator('#searchbox_input').typeWithMistakes('stealthwright automation', {
      delay: 150,
      mistakeProbability: 0.2
    });
    
    // Press Enter to search instead of clicking a button
    console.log('Submitting search...');
    await page.locator('#searchbox_input').press('Enter');
    console.log('Search executed');
    
    // Wait for results
    await page.waitForTimeout(3000);
    
    // Take another screenshot
    console.log('Taking screenshot of search results...');
    await page.screenshot({ path: 'search-results.png' });
    console.log('Screenshot saved to search-results.png');

    await page.goto("https://abrahamjuliot.github.io/creepjs/");
    await page.waitForTimeout(10000);
    await page.screenshot({ 
        path: 'examplecreep.png', 
        fullPage: true 
      });
    
    console.log('Basic test completed successfully!');
    
  } catch (error) {
    console.error('Test failed with error:', error);
  } finally {
    // Close the browser
    if (browser) {
      console.log('Closing browser...');
      await browser.close();
      console.log('Browser closed');
      process.exit(0);
    }
  }
})();