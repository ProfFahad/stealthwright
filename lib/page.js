/**
 * Stealthwright Page Module
 * 
 * This module provides page interaction capabilities similar to Playwright.
 * It includes element locators, navigation, and page actions.
 */

const fs = require('fs-extra');
const path = require('path');
const { errors } = require('./errors');

/**
 * Locator class for interacting with DOM elements
 */
class Locator {
  /**
   * Create a new locator
   * @param {Page} page - The page instance
   * @param {string} selector - CSS selector for the element
   */
  constructor(page, selector) {
    this.page = page;
    this.selector = selector;
    this.timeout = 30000; // Default timeout in ms
    this.interval = 350; // Default polling interval in ms
  }

  /**
   * Check if the element exists in the DOM
   * @returns {Promise<boolean>} - True if element exists
   */
  async elementExists() {
    try {
      const params = {
        expression: `document.querySelector("${this.selector}") !== null`,
        returnByValue: true
      };

      const response = await this.page.browser.sendCommand("Runtime.evaluate", params);

      if (response && response.result && response.result.result) {
        return response.result.result.value === true;
      }

      return false;
    } catch (error) {
      console.error(`Error checking element existence: ${error}`);
      return false;
    }
  }

  /**
   * Wait for element to appear in the DOM
   * @param {Object} [options] - Wait options
   * @param {number} [options.timeout] - Custom timeout in ms
   * @param {string} [options.state='visible'] - Wait state (attached, detached, visible, hidden)
   * @returns {Promise<boolean>} - True if element appeared before timeout
   */
  async waitFor(options = {}) {
    const startTime = Date.now();
    const timeoutToUse = options.timeout || this.timeout;
    const state = options.state || 'visible';
    
    let checkFunction;
    
    switch (state) {
      case 'attached':
        checkFunction = async () => await this.elementExists();
        break;
      case 'detached':
        checkFunction = async () => !(await this.elementExists());
        break;
      case 'visible':
        checkFunction = async () => await this.isVisible();
        break;
      case 'hidden':
        checkFunction = async () => !(await this.isVisible());
        break;
      default:
        checkFunction = async () => await this.elementExists();
    }

    while (Date.now() - startTime < timeoutToUse) {
      const result = await checkFunction();

      if (result) {
        return true;
      }

      // Sleep for the polling interval
      await new Promise(resolve => setTimeout(resolve, this.interval));
    }

    throw new errors.TimeoutError(`Timed out waiting ${timeoutToUse}ms for selector "${this.selector}" to be in state "${state}"`);
  }

  /**
   * Fill a form field with text
   * @param {string} value - Text to fill into the field
   * @param {Object} [options] - Fill options
   * @returns {Promise<void>}
   */
  async fill(value, options = {}) {
    try {
      await this.waitFor({ state: 'visible' });

      // Focus element
      await this.page.browser.sendCommand("Runtime.evaluate", {
        expression: `document.querySelector("${this.selector}").focus()`
      });

      // Clear existing content (Cmd+A then Backspace)
      await this.page.browser.sendCommand("Input.dispatchKeyEvent", {
        type: "keyDown",
        modifiers: 2, // Command key modifier
        key: "a"
      });

      await this.page.browser.sendCommand("Input.dispatchKeyEvent", {
        type: "keyDown",
        key: "Backspace"
      });

      // Insert new text
      await this.page.browser.sendCommand("Input.insertText", {
        text: value
      });

      console.log(`Filled selector ${this.selector} with value: ${value}`);
    } catch (error) {
      console.error(`Failed to fill element: ${error}`);
      throw error;
    }
  }

  /**
   * Click on an element
   * @param {Object} [options] - Click options
   * @returns {Promise<void>}
   */
  async click(options = {}) {
    try {
      await this.waitFor({ state: 'visible' });

      await this.page.browser.sendCommand("Runtime.evaluate", {
        expression: `
          (function() {
            const element = document.querySelector("${this.selector}");
            if (!element) throw new Error('Element not found');
            
            // Get element position for native click
            const rect = element.getBoundingClientRect();
            const x = rect.left + rect.width / 2;
            const y = rect.top + rect.height / 2;
            
            // Create click info for debugging
            window._stealthwrightClickInfo = { selector: "${this.selector}", x, y };
            
            // Standard DOM click (works for most cases)
            element.click();
            
            return { x, y };
          })()
        `,
        returnByValue: true,
        awaitPromise: true
      });

      console.log(`Clicked on selector: ${this.selector}`);
    } catch (error) {
      console.error(`Failed to click element: ${error}`);
      throw error;
    }
  }

  /**
   * Double click on an element
   * @param {Object} [options] - Click options
   * @returns {Promise<void>}
   */
  async dblclick(options = {}) {
    try {
      await this.waitFor({ state: 'visible' });

      await this.page.browser.sendCommand("Runtime.evaluate", {
        expression: `
          (function() {
            const element = document.querySelector("${this.selector}");
            if (!element) throw new Error('Element not found');
            
            // Create and dispatch a double-click event
            const event = new MouseEvent('dblclick', {
              bubbles: true,
              cancelable: true,
              view: window
            });
            element.dispatchEvent(event);
          })()
        `,
        awaitPromise: true
      });

      console.log(`Double-clicked on selector: ${this.selector}`);
    } catch (error) {
      console.error(`Failed to double-click element: ${error}`);
      throw error;
    }
  }

  /**
   * Type text sequentially with delays between each character
   * @param {string} text - Text to type
   * @param {Object} [options] - Type options
   * @param {number} [options.delay=100] - Delay between keypresses in ms
   * @returns {Promise<void>}
   */
  async type(text, options = {}) {
    try {
      await this.waitFor({ state: 'visible' });

      const delay = options.delay || 100;

      // Focus element
      await this.page.browser.sendCommand("Runtime.evaluate", {
        expression: `document.querySelector("${this.selector}").focus()`
      });

      // Type each character with delay
      for (const char of text) {
        await this.page.browser.sendCommand("Input.insertText", {
          text: char
        });

        await new Promise(resolve => setTimeout(resolve, delay));
      }

      console.log(`Typed text into selector ${this.selector}: ${text}`);
    } catch (error) {
      console.error(`Failed to type text: ${error}`);
      throw error;
    }
  }

  /**
   * Type text with random typing mistakes that are corrected
   * @param {string} text - Text to type
   * @param {Object} [options] - Type options  
   * @param {number} [options.delay=100] - Delay between keypresses in ms
   * @param {number} [options.mistakeProbability=0.3] - Probability of making a mistake (0-1)
   * @returns {Promise<void>}
   */
  async typeWithMistakes(text, options = {}) {
    try {
      await this.waitFor({ state: 'visible' });

      const delay = options.delay || 100;
      const mistakeProbability = options.mistakeProbability || 0.3;

      // Focus element
      await this.page.browser.sendCommand("Runtime.evaluate", {
        expression: `document.querySelector("${this.selector}").focus()`
      });

      // Type each character with potential mistakes
      for (const char of text) {
        // Chance to make a mistake
        if (Math.random() < mistakeProbability) {
          // Type a wrong character
          const wrongChar = String.fromCharCode(97 + Math.floor(Math.random() * 26)); // random a-z

          await this.page.browser.sendCommand("Input.insertText", {
            text: wrongChar
          });

          await new Promise(resolve => setTimeout(resolve, delay));

          // Delete wrong character
          await this.page.browser.sendCommand("Input.dispatchKeyEvent", {
            type: "rawKeyDown",
            key: "Backspace",
            windowsVirtualKeyCode: 8,
            nativeVirtualKeyCode: 8
          });

          await new Promise(resolve => setTimeout(resolve, delay));
        }

        // Type correct character
        await this.page.browser.sendCommand("Input.insertText", {
          text: char
        });

        await new Promise(resolve => setTimeout(resolve, delay));
      }

      console.log(`Typed text with mistakes into selector ${this.selector}: ${text}`);
    } catch (error) {
      console.error(`Failed to type text with mistakes: ${error}`);
      throw error;
    }
  }

  /**
   * Press a key on the keyboard
   * @param {string} key - Key to press
   * @param {Object} [options] - Press options
   * @returns {Promise<void>}
   */
  async press(key, options = {}) {
    try {
      await this.waitFor({ state: 'visible' });
  
      // Focus element
      await this.page.browser.sendCommand("Runtime.evaluate", {
        expression: `document.querySelector("${this.selector}").focus()`
      });
  
      // For Enter key, use a more robust approach with proper key codes
      if (key === 'Enter' || key === 'Return') {
        // Key down event
        await this.page.browser.sendCommand("Input.dispatchKeyEvent", {
          type: "keyDown",
          windowsVirtualKeyCode: 13,  // Enter key code
          code: "Enter",
          key: "Enter",
          text: "\r"
        });
        
        // Add a small delay (key held down)
        await new Promise(resolve => setTimeout(resolve, 10));
        
        // Key up event
        await this.page.browser.sendCommand("Input.dispatchKeyEvent", {
          type: "keyUp",
          windowsVirtualKeyCode: 13,  // Enter key code
          code: "Enter",
          key: "Enter"
        });
        
        console.log(`Pressed Enter key on selector ${this.selector}`);
        return;
      }
  
      // For other keys, use the standard approach
      await this.page.browser.sendCommand("Input.dispatchKeyEvent", {
        type: "keyDown",
        key: key
      });
  
      await this.page.browser.sendCommand("Input.dispatchKeyEvent", {
        type: "keyUp",
        key: key
      });
  
      console.log(`Pressed key ${key} on selector ${this.selector}`);
    } catch (error) {
      console.error(`Failed to press key: ${error}`);
      throw error;
    }
  }

  /**
   * Get the inner text of an element
   * @returns {Promise<string>} - Inner text content
   */
  async innerText() {
    try {
      await this.waitFor({ state: 'attached' });

      const response = await this.page.browser.sendCommand("Runtime.evaluate", {
        expression: `document.querySelector("${this.selector}").innerText`,
        returnByValue: true
      });

      if (response && response.result && response.result.result) {
        return response.result.result.value;
      }

      throw new Error(`Unexpected response format for inner text: ${JSON.stringify(response)}`);
    } catch (error) {
      console.error(`Failed to get inner text: ${error}`);
      throw error;
    }
  }

  /**
   * Get the text content of an element
   * @returns {Promise<string>} - Text content
   */
  async textContent() {
    try {
      await this.waitFor({ state: 'attached' });

      const response = await this.page.browser.sendCommand("Runtime.evaluate", {
        expression: `document.querySelector("${this.selector}").textContent`,
        returnByValue: true
      });

      if (response && response.result && response.result.result) {
        return response.result.result.value;
      }

      throw new Error(`Unexpected response format for text content: ${JSON.stringify(response)}`);
    } catch (error) {
      console.error(`Failed to get text content: ${error}`);
      throw error;
    }
  }

  /**
   * Get an attribute value from an element
   * @param {string} attributeName - Name of the attribute
   * @returns {Promise<string|null>} - Attribute value or null if not found
   */
  async getAttribute(attributeName) {
    try {
      await this.waitFor({ state: 'attached' });

      const response = await this.page.browser.sendCommand("Runtime.evaluate", {
        expression: `document.querySelector("${this.selector}").getAttribute("${attributeName}")`,
        returnByValue: true
      });

      if (response && response.result && response.result.result) {
        return response.result.result.value;
      }

      return null;
    } catch (error) {
      console.error(`Failed to get attribute: ${error}`);
      throw error;
    }
  }

  /**
   * Check if an element is visible
   * @returns {Promise<boolean>} - True if element is visible
   */
  async isVisible() {
    try {
      const exists = await this.elementExists();
      if (!exists) return false;

      const response = await this.page.browser.sendCommand("Runtime.evaluate", {
        expression: `
          (function() {
            const element = document.querySelector("${this.selector}");
            if (!element) return false;
            
            const style = window.getComputedStyle(element);
            if (style.display === 'none' || 
                style.visibility === 'hidden' || 
                style.opacity === '0') {
              return false;
            }

            // Check if element is in viewport
            const rect = element.getBoundingClientRect();
            return rect.width > 0 && 
                   rect.height > 0 && 
                   rect.top < window.innerHeight &&
                   rect.left < window.innerWidth &&
                   rect.bottom > 0 &&
                   rect.right > 0;
          })()
        `,
        returnByValue: true
      });

      if (response && response.result && response.result.result) {
        return response.result.result.value === true;
      }

      return false;
    } catch (error) {
      console.error(`Failed to check visibility: ${error}`);
      return false;
    }
  }

  /**
   * Check element states
   * @returns {Promise<Object>} - Element states
   */
  async highlight() {
    try {
      await this.waitFor({ state: 'attached' });

      await this.page.browser.sendCommand("Runtime.evaluate", {
        expression: `
          (function() {
            const element = document.querySelector("${this.selector}");
            if (!element) return;
            
            const originalOutline = element.style.outline;
            element.style.outline = '3px solid red';
            
            setTimeout(() => {
              element.style.outline = originalOutline;
            }, 2000);
          })()
        `
      });
    } catch (error) {
      console.error(`Failed to highlight element: ${error}`);
      throw error;
    }
  }

  /**
   * Get bounding box of element
   * @returns {Promise<Object>} - Bounding box (x, y, width, height)
   */
  async boundingBox() {
    try {
      await this.waitFor({ state: 'attached' });

      const response = await this.page.browser.sendCommand("Runtime.evaluate", {
        expression: `
          (function() {
            const element = document.querySelector("${this.selector}");
            if (!element) return null;
            const rect = element.getBoundingClientRect();
            return {
              x: rect.left,
              y: rect.top,
              width: rect.width,
              height: rect.height
            };
          })()
        `,
        returnByValue: true
      });

      if (response && response.result && response.result.result && response.result.result.value) {
        return response.result.result.value;
      }

      return null;
    } catch (error) {
      console.error(`Failed to get bounding box: ${error}`);
      throw error;
    }
  }

  /**
   * Check if element is checked (for checkboxes, radio buttons)
   * @returns {Promise<boolean>} - True if element is checked
   */
  async isChecked() {
    try {
      await this.waitFor({ state: 'attached' });

      const response = await this.page.browser.sendCommand("Runtime.evaluate", {
        expression: `
          (function() {
            const element = document.querySelector("${this.selector}");
            if (!element) return false;
            return element.checked === true;
          })()
        `,
        returnByValue: true
      });

      if (response && response.result && response.result.result) {
        return response.result.result.value === true;
      }

      return false;
    } catch (error) {
      console.error(`Failed to check if element is checked: ${error}`);
      return false;
    }
  }

  /**
   * Get all selected options from a select element
   * @returns {Promise<Array<string>>} - Array of selected option values
   */
  async selectedOptions() {
    try {
      await this.waitFor({ state: 'attached' });

      const response = await this.page.browser.sendCommand("Runtime.evaluate", {
        expression: `
          (function() {
            const element = document.querySelector("${this.selector}");
            if (!element || element.tagName.toLowerCase() !== 'select') 
              return [];
            
            return Array.from(element.selectedOptions).map(option => ({
              value: option.value,
              text: option.text
            }));
          })()
        `,
        returnByValue: true
      });

      if (response && response.result && response.result.result && response.result.result.value) {
        return response.result.result.value;
      }

      return [];
    } catch (error) {
      console.error(`Failed to get selected options: ${error}`);
      return [];
    }
  }

  /**
   * Select option(s) from a select element
   * @param {string|Array<string>} values - Value or array of values to select
   * @returns {Promise<void>}
   */
  async selectOption(values) {
    try {
      await this.waitFor({ state: 'visible' });

      const valuesArray = Array.isArray(values) ? values : [values];
      const valuesJson = JSON.stringify(valuesArray);

      await this.page.browser.sendCommand("Runtime.evaluate", {
        expression: `
          (function() {
            const element = document.querySelector("${this.selector}");
            if (!element || element.tagName.toLowerCase() !== 'select') 
              throw new Error('Element is not a select element');
            
            const values = ${valuesJson};
            
            // Deselect all options first (for multi-select)
            if (element.multiple) {
              for (const option of element.options) {
                option.selected = false;
              }
            }
            
            // Select the options that match the values
            let matched = false;
            for (const option of element.options) {
              if (values.includes(option.value)) {
                option.selected = true;
                matched = true;
              }
            }
            
            if (!matched) {
              throw new Error('No options matched the specified values');
            }
            
            // Dispatch change event
            element.dispatchEvent(new Event('change', { bubbles: true }));
          })()
        `,
        awaitPromise: true
      });

      console.log(`Selected options ${valuesJson} on selector ${this.selector}`);
    } catch (error) {
      console.error(`Failed to select options: ${error}`);
      throw error;
    }
  }

  /**
   * Check or uncheck a checkbox or radio button
   * @param {boolean} [checked=true] - Whether to check or uncheck
   * @returns {Promise<void>}
   */
  async setChecked(checked = true) {
    try {
      await this.waitFor({ state: 'visible' });

      await this.page.browser.sendCommand("Runtime.evaluate", {
        expression: `
          (function() {
            const element = document.querySelector("${this.selector}");
            if (!element) throw new Error('Element not found');
            
            if (element.type !== 'checkbox' && element.type !== 'radio')
              throw new Error('Element is not a checkbox or radio button');
            
            const currentChecked = element.checked;
            
            if (currentChecked !== ${checked}) {
              element.click();
            }
          })()
        `,
        awaitPromise: true
      });

      console.log(`Set checked state to ${checked} on selector ${this.selector}`);
    } catch (error) {
      console.error(`Failed to set checked state: ${error}`);
      throw error;
    }
  }

  /**
   * Hover over an element
   * @returns {Promise<void>}
   */
  async hover() {
    try {
      await this.waitFor({ state: 'visible' });

      await this.page.browser.sendCommand("Runtime.evaluate", {
        expression: `
          (function() {
            const element = document.querySelector("${this.selector}");
            if (!element) throw new Error('Element not found');
            
            // Create and dispatch mouse events
            element.dispatchEvent(new MouseEvent('mouseover', {
              bubbles: true,
              cancelable: true,
              view: window
            }));
            
            element.dispatchEvent(new MouseEvent('mouseenter', {
              bubbles: false,
              cancelable: true,
              view: window
            }));
          })()
        `,
        awaitPromise: true
      });

      console.log(`Hovered over selector: ${this.selector}`);
    } catch (error) {
      console.error(`Failed to hover over element: ${error}`);
      throw error;
    }
  }
}

/**
 * Page class for interacting with browser pages
 */
class Page {
  /**
   * Create a new Page
   * @param {Browser} browser - Browser instance
   */
  constructor(browser) {
    this.browser = browser;
    this.closed = false;
    this.url = 'about:blank';
    this.defaultTimeout = 30000;
    this._listeners = {};
  }

  /**
   * Create a locator for selecting DOM elements
   * @param {string} selector - CSS selector
   * @returns {Locator} - Locator instance
   */
  locator(selector) {
    return new Locator(this, selector);
  }

  /**
   * Wait for a specified amount of time
   * @param {number} milliseconds - Time to wait in ms
   * @returns {Promise<void>}
   */
  async waitForTimeout(milliseconds) {
    await new Promise(resolve => setTimeout(resolve, milliseconds));
  }

  /**
   * Navigate to a URL
   * @param {string} url - URL to navigate to
   * @param {Object} [options] - Navigation options
   * @param {boolean} [options.waitUntil='load'] - When to consider navigation finished
   * @param {number} [options.timeout] - Navigation timeout in ms
   * @returns {Promise<Response|null>} - Response or null
   */
  async goto(url, options = {}) {
    try {
      const waitUntil = options.waitUntil || 'load';
      const timeout = options.timeout || this.defaultTimeout;
      
      console.log(`Navigating to: ${url}`);

      await this.browser.sendCommand("Page.enable", {});
      await this.browser.sendCommand("Network.enable", {});

      const navigationPromise = this._waitForNavigation({ waitUntil, timeout });

      await this.browser.sendCommand("Page.navigate", { url });
      this.url = url;

      // Wait for navigation to complete
      await navigationPromise;

      console.log(`Successfully navigated to: ${url}`);
      return { ok: true };
    } catch (error) {
      console.error(`Failed to navigate to ${url}: ${error}`);
      throw error;
    }
  }

  /**
   * Evaluate a function in the page context
   * @param {Function|string} pageFunction - Function or string to evaluate
   * @param {...any} args - Arguments to pass to the function
   * @returns {Promise<any>} - Result of the function evaluation
   */
  async evaluate(pageFunction, ...args) {
    try {
      // Handle both function and string
      let expression;
      if (typeof pageFunction === 'function') {
        // Convert function and arguments to string representation
        const stringifiedArgs = JSON.stringify(args);
        expression = `(${pageFunction.toString()})(${stringifiedArgs.slice(1, -1)})`;
      } else {
        expression = pageFunction;
      }

      const response = await this.browser.sendCommand("Runtime.evaluate", {
        expression,
        returnByValue: true,
        awaitPromise: true
      });

      if (response && response.result && response.result.result) {
        return response.result.result.value;
      }

      return null;
    } catch (error) {
      console.error(`Failed to evaluate script: ${error}`);
      throw error;
    }
  }

  /**
   * Evaluate a function in the page context and return a JSHandle
   * @param {Function|string} pageFunction - Function or string to evaluate
   * @param {...any} args - Arguments to pass to the function
   * @returns {Promise<any>} - Result as a serialized handle
   */
  async evaluateHandle(pageFunction, ...args) {
    try {
      // Handle both function and string
      let expression;
      if (typeof pageFunction === 'function') {
        // Convert function and arguments to string representation
        const stringifiedArgs = JSON.stringify(args);
        expression = `(${pageFunction.toString()})(${stringifiedArgs.slice(1, -1)})`;
      } else {
        expression = pageFunction;
      }

      const response = await this.browser.sendCommand("Runtime.evaluate", {
        expression,
        returnByValue: false,
        awaitPromise: true
      });

      if (response && response.result) {
        return response.result;
      }

      return null;
    } catch (error) {
      console.error(`Failed to evaluate handle: ${error}`);
      throw error;
    }
  }

  /**
   * Wait for navigation to complete
   * @param {Object} [options={}] - Navigation options
   * @param {string} [options.waitUntil='load'] - Navigation event to wait for
   * @param {number} [options.timeout=30000] - Navigation timeout in ms
   * @returns {Promise<void>}
   */
  async _waitForNavigation(options = {}) {
    const waitUntil = options.waitUntil || 'load';
    const timeout = options.timeout || 30000;
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const checkNavigation = async () => {
        try {
          if (Date.now() - startTime > timeout) {
            reject(new errors.TimeoutError(`Navigation timeout of ${timeout}ms exceeded`));
            return;
          }

          let readyState = 'loading';
          try {
            const response = await this.browser.sendCommand("Runtime.evaluate", {
              expression: "document.readyState",
              returnByValue: true
            });

            if (response && response.result && response.result.result) {
              readyState = response.result.result.value;
            }
          } catch (err) {
            // Ignore evaluation errors during navigation
            setTimeout(checkNavigation, 100);
            return;
          }

          let isDone = false;
          switch (waitUntil) {
            case 'load':
              isDone = readyState === 'complete';
              break;
            case 'domcontentloaded':
              isDone = readyState === 'interactive' || readyState === 'complete';
              break;
            case 'networkidle0':
              // Simplified approximation - check complete and wait a bit
              if (readyState === 'complete') {
                await new Promise(r => setTimeout(r, 500));
                isDone = true;
              }
              break;
            case 'networkidle2':
              // Simplified approximation - check complete and wait a bit
              if (readyState === 'complete') {
                await new Promise(r => setTimeout(r, 300));
                isDone = true;
              }
              break;
            default:
              isDone = readyState === 'complete';
          }

          if (isDone) {
            resolve();
          } else {
            setTimeout(checkNavigation, 100);
          }
        } catch (error) {
          setTimeout(checkNavigation, 100);
        }
      };

      checkNavigation();
    });
  }

  /**
   * Wait for navigation to complete
   * @param {Object} [options={}] - Navigation options
   * @returns {Promise<void>}
   */
  async waitForNavigation(options = {}) {
    return this._waitForNavigation(options);
  }

  /**
   * Wait for a selector to appear
   * @param {string} selector - CSS selector to wait for
   * @param {Object} [options] - Wait options
   * @returns {Promise<Locator>} - Locator for the found element
   */
  async waitForSelector(selector, options = {}) {
    const locator = this.locator(selector);
    await locator.waitFor(options);
    return locator;
  }

  /**
   * Wait for a function to return a truthy value
   * @param {Function} predicate - Function to evaluate
   * @param {Object} [options] - Wait options
   * @returns {Promise<any>} - Return value of the predicate
   */
  async waitForFunction(predicate, options = {}) {
    const timeout = options.timeout || this.defaultTimeout;
    const polling = options.polling || 'raf'; // 'raf' or number in ms
    const startTime = Date.now();

    let pollingInterval;
    if (polling === 'raf') {
      pollingInterval = 16; // Approximate to 60fps
    } else if (typeof polling === 'number') {
      pollingInterval = polling;
    } else {
      pollingInterval = 100; // Default polling
    }

    return new Promise(async (resolve, reject) => {
      const checkPredicate = async () => {
        try {
          if (Date.now() - startTime > timeout) {
            reject(new errors.TimeoutError(`Timed out while waiting for predicate to return truthy value`));
            return;
          }

          const result = await this.evaluate(predicate);
          
          if (result) {
            resolve(result);
          } else {
            setTimeout(checkPredicate, pollingInterval);
          }
        } catch (error) {
          setTimeout(checkPredicate, pollingInterval);
        }
      };

      checkPredicate();
    });
  }

  /**
   * Save cookies to a file
   * @param {string} filePath - File path to save cookies
   * @returns {Promise<void>}
   */
  async saveCookies(filePath) {
    try {
      // Get all cookies from the browser
      const response = await this.browser.sendCommand("Network.getAllCookies", {});

      if (!response || !response.result || !response.result.cookies) {
        console.error("No cookies found to save");
        return;
      }

      const cookies = response.result.cookies;
      console.log(`Found ${cookies.length} cookies to save`);

      // Create directory if it doesn't exist
      const dirPath = path.dirname(filePath);
      await fs.ensureDir(dirPath);
      
      // Write the cookie file
      await fs.writeJson(filePath, cookies, { spaces: 2 });
      console.log(`Cookies saved to: ${filePath}`);
    } catch (error) {
      console.error(`Failed to save cookies: ${error}`);
      throw error;
    }
  }

  /**
   * Load cookies from a file
   * @param {string} filePath - File path to load cookies from
   * @returns {Promise<void>}
   */
  async loadCookies(filePath) {
    try {
      // Check if file exists
      if (!await fs.pathExists(filePath)) {
        throw new Error(`Cookie file not found: ${filePath}`);
      }

      // Read and parse cookies
      const cookies = await fs.readJson(filePath);

      console.log(`Loading ${cookies.length} cookies from ${filePath}`);

      // Inject each cookie
      for (const cookie of cookies) {
        await this.browser.sendCommand("Network.setCookie", cookie);
      }

      console.log(`Successfully loaded cookies`);
    } catch (error) {
      console.error(`Failed to load cookies: ${error}`);
      throw error;
    }
  }

  /**
   * Take a screenshot of the current page
   * @param {Object} [options={}] - Screenshot options
   * @param {string} [options.path] - File path to save screenshot
   * @param {boolean} [options.fullPage=false] - Whether to take a full page screenshot
   * @returns {Promise<Buffer>} - Screenshot as a Buffer
   */
  async screenshot(options = {}) {
    try {
      const fullPage = options.fullPage || false;
      
      if (fullPage) {
        // Get page dimensions
        const dimensions = await this.evaluate(() => {
          return {
            width: Math.max(
              document.body.scrollWidth,
              document.documentElement.scrollWidth,
              document.body.offsetWidth,
              document.documentElement.offsetWidth,
              document.body.clientWidth,
              document.documentElement.clientWidth
            ),
            height: Math.max(
              document.body.scrollHeight,
              document.documentElement.scrollHeight,
              document.body.offsetHeight,
              document.documentElement.offsetHeight,
              document.body.clientHeight,
              document.documentElement.clientHeight
            )
          };
        });
        
        // Set viewport to match full page size
        await this.browser.sendCommand('Emulation.setDeviceMetricsOverride', {
          width: dimensions.width,
          height: dimensions.height,
          deviceScaleFactor: 1,
          mobile: false
        });
      }
      
      // Capture screenshot
      const result = await this.browser.sendCommand('Page.captureScreenshot');
      
      if (fullPage) {
        // Reset viewport
        await this.browser.sendCommand('Emulation.clearDeviceMetricsOverride');
      }
      
      if (!result || !result.result || !result.result.data) {
        throw new Error('Failed to capture screenshot');
      }
      
      const buffer = Buffer.from(result.result.data, 'base64');
      
      // Save to file if path provided
      if (options.path) {
        await fs.ensureDir(path.dirname(options.path));
        await fs.writeFile(options.path, buffer);
        console.log(`Screenshot saved to: ${options.path}`);
      }
      
      return buffer;
    } catch (error) {
      console.error(`Failed to take screenshot: ${error}`);
      throw error;
    }
  }

  /**
   * Find multiple elements using a selector
   * @param {string} selector - CSS selector
   * @returns {Promise<Array>} - Array of element handles
   */
  async $$(selector) {
    try {
      const response = await this.browser.sendCommand("Runtime.evaluate", {
        expression: `Array.from(document.querySelectorAll("${selector}")).map((el, i) => { 
          return { index: i, text: el.innerText || el.textContent || '' }; 
        })`,
        returnByValue: true
      });

      if (response && response.result && response.result.result && response.result.result.value) {
        return response.result.result.value;
      }

      return [];
    } catch (error) {
      console.error(`Failed to find elements: ${error}`);
      return [];
    }
  }

  /**
   * Find a single element using a selector
   * @param {string} selector - CSS selector
   * @returns {Promise<Object|null>} - Element handle or null
   */
  async $(selector) {
    try {
      const response = await this.browser.sendCommand("Runtime.evaluate", {
        expression: `
          (function() {
            const element = document.querySelector("${selector}");
            if (!element) return null;
            
            return { 
              exists: true,
              textContent: element.textContent || '',
              innerText: element.innerText || '',
              tagName: element.tagName,
              id: element.id,
              className: element.className
            };
          })()
        `,
        returnByValue: true
      });

      if (response && response.result && response.result.result && response.result.result.value) {
        return response.result.result.value;
      }

      return null;
    } catch (error) {
      console.error(`Failed to find element: ${error}`);
      return null;
    }
  }

  /**
   * Navigate back in the browser history
   * @param {Object} [options] - Navigation options
   * @returns {Promise<void>}
   */
  async goBack(options = {}) {
    try {
      const waitOptions = { ...options };
      const navigationPromise = this._waitForNavigation(waitOptions);

      await this.browser.sendCommand("Page.navigate", { 
        url: "javascript:history.back()" 
      });
      
      await navigationPromise;
    } catch (error) {
      console.error(`Failed to navigate back: ${error}`);
      throw error;
    }
  }

  /**
   * Navigate forward in the browser history 
   * @param {Object} [options] - Navigation options
   * @returns {Promise<void>}
   */
  async goForward(options = {}) {
    try {
      const waitOptions = { ...options };
      const navigationPromise = this._waitForNavigation(waitOptions);

      await this.browser.sendCommand("Page.navigate", { 
        url: "javascript:history.forward()" 
      });
      
      await navigationPromise;
    } catch (error) {
      console.error(`Failed to navigate forward: ${error}`);
      throw error;
    }
  }

  /**
   * Reload the current page
   * @param {Object} [options] - Navigation options
   * @returns {Promise<void>}
   */
  async reload(options = {}) {
    try {
      const waitOptions = { ...options };
      const navigationPromise = this._waitForNavigation(waitOptions);

      await this.browser.sendCommand("Page.reload");
      
      await navigationPromise;
    } catch (error) {
      console.error(`Failed to reload page: ${error}`);
      throw error;
    }
  }

  /**
   * Get the page title
   * @returns {Promise<string>} - Page title
   */
  async title() {
    try {
      const response = await this.browser.sendCommand("Runtime.evaluate", {
        expression: "document.title",
        returnByValue: true
      });

      if (response && response.result && response.result.result) {
        return response.result.result.value;
      }
      
      return "";
    } catch (error) {
      console.error(`Failed to get page title: ${error}`);
      throw error;
    }
  }

  /**
   * Get the current URL
   * @returns {Promise<string>} - Current URL
   */
  async url() {
    try {
      const response = await this.browser.sendCommand("Runtime.evaluate", {
        expression: "window.location.href",
        returnByValue: true
      });

      if (response && response.result && response.result.result) {
        this.url = response.result.result.value;
        return this.url;
      }
      
      return this.url;
    } catch (error) {
      console.error(`Failed to get page URL: ${error}`);
      throw error;
    }
  }

  /**
   * Set HTTP headers
   * @param {Object} headers - HTTP headers to set
   * @returns {Promise<void>}
   */
  async setExtraHTTPHeaders(headers) {
    try {
      await this.browser.sendCommand('Network.setExtraHTTPHeaders', {
        headers
      });
    } catch (error) {
      console.error(`Failed to set extra HTTP headers: ${error}`);
      throw error;
    }
  }

  /**
   * Add a script tag to the page
   * @param {Object} options - Script options
   * @param {string} [options.url] - URL to load script from
   * @param {string} [options.path] - Path to load script from
   * @param {string} [options.content] - Script content
   * @returns {Promise<void>}
   */
  async addScriptTag(options) {
    try {
      let scriptContent;
      
      if (options.url) {
        await this.evaluate((url) => {
          const script = document.createElement('script');
          script.src = url;
          script.type = 'text/javascript';
          document.head.appendChild(script);
          
          return new Promise((resolve, reject) => {
            script.onload = resolve;
            script.onerror = reject;
          });
        }, options.url);
        return;
      } else if (options.path) {
        scriptContent = await fs.readFile(options.path, 'utf8');
      } else if (options.content) {
        scriptContent = options.content;
      } else {
        throw new Error('Either url, path or content must be specified');
      }
      
      await this.evaluate((content) => {
        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.text = content;
        document.head.appendChild(script);
      }, scriptContent);
    } catch (error) {
      console.error(`Failed to add script tag: ${error}`);
      throw error;
    }
  }

  /**
   * Add a style tag to the page
   * @param {Object} options - Style options
   * @param {string} [options.url] - URL to load style from
   * @param {string} [options.path] - Path to load style from
   * @param {string} [options.content] - Style content
   * @returns {Promise<void>}
   */
  async addStyleTag(options) {
    try {
      let styleContent;
      
      if (options.url) {
        await this.evaluate((url) => {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = url;
          document.head.appendChild(link);
          
          return new Promise((resolve, reject) => {
            link.onload = resolve;
            link.onerror = reject;
          });
        }, options.url);
        return;
      } else if (options.path) {
        styleContent = await fs.readFile(options.path, 'utf8');
      } else if (options.content) {
        styleContent = options.content;
      } else {
        throw new Error('Either url, path or content must be specified');
      }
      
      await this.evaluate((content) => {
        const style = document.createElement('style');
        style.type = 'text/css';
        style.appendChild(document.createTextNode(content));
        document.head.appendChild(style);
      }, styleContent);
    } catch (error) {
      console.error(`Failed to add style tag: ${error}`);
      throw error;
    }
  }

  /**
   * Get current page content
   * @returns {Promise<string>} - Page HTML content
   */
  async content() {
    try {
      const response = await this.browser.sendCommand("Runtime.evaluate", {
        expression: "document.documentElement.outerHTML",
        returnByValue: true
      });

      if (response && response.result && response.result.result) {
        return response.result.result.value;
      }
      
      return "";
    } catch (error) {
      console.error(`Failed to get page content: ${error}`);
      throw error;
    }
  }

  /**
   * Set page content
   * @param {string} html - HTML content to set
   * @param {Object} [options] - Set content options
   * @returns {Promise<void>}
   */
  async setContent(html, options = {}) {
    try {
      const waitUntil = options.waitUntil || 'load';
      const timeout = options.timeout || this.defaultTimeout;
      
      const navigationPromise = this._waitForNavigation({ 
        waitUntil, 
        timeout 
      });

      await this.browser.sendCommand("Runtime.evaluate", {
        expression: `document.open(); document.write(${JSON.stringify(html)}); document.close();`
      });
      
      await navigationPromise;
    } catch (error) {
      console.error(`Failed to set page content: ${error}`);
      throw error;
    }
  }

  /**
   * Focus an element
   * @param {string} selector - CSS selector
   * @returns {Promise<void>}
   */
  async focus(selector) {
    const locator = this.locator(selector);
    await locator.waitFor({ state: 'visible' });
    
    await this.browser.sendCommand("Runtime.evaluate", {
      expression: `document.querySelector("${selector}").focus()`
    });
  }

  /**
   * Get all cookies
   * @returns {Promise<Array>} - Array of cookies
   */
  async cookies() {
    try {
      const response = await this.browser.sendCommand("Network.getAllCookies", {});

      if (response && response.result && response.result.cookies) {
        return response.result.cookies;
      }
      
      return [];
    } catch (error) {
      console.error(`Failed to get cookies: ${error}`);
      throw error;
    }
  }

  /**
   * Set cookies
   * @param {Array} cookies - Cookies to set
   * @returns {Promise<void>}
   */
  async setCookies(cookies) {
    try {
      for (const cookie of cookies) {
        await this.browser.sendCommand("Network.setCookie", cookie);
      }
    } catch (error) {
      console.error(`Failed to set cookies: ${error}`);
      throw error;
    }
  }

  /**
   * Delete cookies
   * @param {Object} [options] - Cookie deletion options
   * @returns {Promise<void>}
   */
  async deleteCookies(options = {}) {
    try {
      if (options.name) {
        // Delete specific cookie
        await this.browser.sendCommand("Network.deleteCookies", {
          name: options.name,
          url: options.url,
          domain: options.domain,
          path: options.path
        });
      } else {
        // Delete all cookies
        await this.browser.sendCommand("Network.clearBrowserCookies", {});
      }
    } catch (error) {
      console.error(`Failed to delete cookies: ${error}`);
      throw error;
    }
  }

  /**
   * Emulate media type
   * @param {Object} options - Media options
   * @param {string} [options.media] - Media type ('screen', 'print', etc.)
   * @returns {Promise<void>}
   */
  async emulateMedia(options = {}) {
    try {
      if (options.media) {
        await this.browser.sendCommand("Emulation.setEmulatedMedia", {
          media: options.media
        });
      }
    } catch (error) {
      console.error(`Failed to emulate media: ${error}`);
      throw error;
    }
  }

  /**
   * Close the page
   * @returns {Promise<void>}
   */
  async close() {
    try {
      if (this.closed) return;
      
      // Use Target.closeTarget to close the page
      await this.browser.sendCommand("Target.closeTarget", {
        targetId: this._targetId
      });
      
      this.closed = true;
    } catch (error) {
      console.error(`Failed to close page: ${error}`);
      throw error;
    }
  }

  /**
   * Set default navigation timeout
   * @param {number} timeout - Timeout in milliseconds
   */
  setDefaultNavigationTimeout(timeout) {
    this.defaultTimeout = timeout;
  }

  /**
   * Set default timeout
   * @param {number} timeout - Timeout in milliseconds
   */
  setDefaultTimeout(timeout) {
    this.defaultTimeout = timeout;
  }

  /**
   * Execute CDP command
   * @param {string} method - CDP method
   * @param {Object} [params] - CDP method parameters
   * @returns {Promise<Object>} - Command result
   */
  async cdp(method, params = {}) {
    return this.browser.sendCommand(method, params);
  }

  /**
   * Add event listener
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   */
  on(event, handler) {
    if (!this._listeners[event]) {
      this._listeners[event] = [];
    }
    this._listeners[event].push(handler);
  }

  /**
   * Remove event listener
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   */
  off(event, handler) {
    if (!this._listeners[event]) return;
    this._listeners[event] = this._listeners[event].filter(h => h !== handler);
  }

  /**
   * Expose function to page
   * @param {string} name - Function name
   * @param {Function} fn - Function to expose
   */
  async exposeFunction(name, fn) {
    try {
      // Create a globally unique ID for this function
      const id = `stealthwright_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      
      // Store the function reference
      global[id] = fn;
      
      // Create a binding in the page
      // hi antibot company (i will change this so dont even bother lol)
      await this.browser.sendCommand("Runtime.evaluate", {
        expression: `
          window["${name}"] = async function() {
            return fetch("https://stealthwright-bridge/${id}", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(Array.from(arguments))
            }).then(r => r.json());
          }
        `
      });
      
      // TODO: Implement actual bridge to call the function
      // This is a simplified version that doesn't actually work
      console.log(`Function ${name} exposed (placeholder implementation)`);
    } catch (error) {
      console.error(`Failed to expose function: ${error}`);
      throw error;
    }
  }

  // -------------- NEW CONVENIENCE METHODS (PLAYWRIGHT-STYLE) --------------

  /**
   * Fill a form field with text (direct method)
   * @param {string} selector - CSS selector for the element
   * @param {string} value - Text to fill into the field
   * @param {Object} [options] - Fill options
   * @returns {Promise<void>}
   */
  async fill(selector, value, options = {}) {
    return this.locator(selector).fill(value, options);
  }

  /**
   * Click on an element (direct method)
   * @param {string} selector - CSS selector for the element
   * @param {Object} [options] - Click options
   * @returns {Promise<void>}
   */
  async click(selector, options = {}) {
    return this.locator(selector).click(options);
  }

  /**
   * Double-click on an element (direct method)
   * @param {string} selector - CSS selector for the element
   * @param {Object} [options] - Click options
   * @returns {Promise<void>}
   */
  async dblclick(selector, options = {}) {
    return this.locator(selector).dblclick(options);
  }

  /**
   * Type text sequentially (direct method)
   * @param {string} selector - CSS selector for the element
   * @param {string} text - Text to type
   * @param {Object} [options] - Type options
   * @returns {Promise<void>}
   */
  async type(selector, text, options = {}) {
    return this.locator(selector).type(text, options);
  }

  /**
   * Type text with random mistakes (direct method)
   * @param {string} selector - CSS selector for the element
   * @param {string} text - Text to type
   * @param {Object} [options] - Type options
   * @returns {Promise<void>}
   */
  async typeWithMistakes(selector, text, options = {}) {
    return this.locator(selector).typeWithMistakes(text, options);
  }

  /**
   * Press a key on an element (direct method)
   * @param {string} selector - CSS selector for the element
   * @param {string} key - Key to press
   * @param {Object} [options] - Press options
   * @returns {Promise<void>}
   */
  async press(selector, key, options = {}) {
    return this.locator(selector).press(key, options);
  }

  /**
   * Get the inner text of an element (direct method)
   * @param {string} selector - CSS selector for the element
   * @returns {Promise<string>} - Inner text content
   */
  async innerText(selector) {
    return this.locator(selector).innerText();
  }

  /**
   * Get the text content of an element (direct method)
   * @param {string} selector - CSS selector for the element
   * @returns {Promise<string>} - Text content
   */
  async textContent(selector) {
    return this.locator(selector).textContent();
  }

  /**
   * Get attribute value from an element (direct method)
   * @param {string} selector - CSS selector for the element
   * @param {string} attributeName - Name of the attribute
   * @returns {Promise<string|null>} - Attribute value or null
   */
  async getAttribute(selector, attributeName) {
    return this.locator(selector).getAttribute(attributeName);
  }

  /**
   * Check if element is visible (direct method)
   * @param {string} selector - CSS selector for the element
   * @returns {Promise<boolean>} - True if element is visible
   */
  async isVisible(selector) {
    return this.locator(selector).isVisible();
  }

  /**
   * Select option(s) from a select element (direct method)
   * @param {string} selector - CSS selector for the element
   * @param {string|Array<string>} values - Value or array of values to select
   * @returns {Promise<void>}
   */
  async selectOption(selector, values) {
    return this.locator(selector).selectOption(values);
  }

  /**
   * Check or uncheck a checkbox or radio button (direct method)
   * @param {string} selector - CSS selector for the element
   * @param {boolean} [checked=true] - Whether to check or uncheck
   * @returns {Promise<void>}
   */
  async setChecked(selector, checked = true) {
    return this.locator(selector).setChecked(checked);
  }

  /**
   * Hover over an element (direct method)
   * @param {string} selector - CSS selector for the element
   * @returns {Promise<void>}
   */
  async hover(selector) {
    return this.locator(selector).hover();
  }
}

module.exports = Page;