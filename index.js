/**
 * Stealthwright - Chrome DevTools Protocol automation library
 * A Playwright-like API implementation using CDP for improved detection avoidance
 */

const { StealthWright } = require('./lib/browser');
const { errors } = require('./lib/errors');

// Create a factory function that returns a Stealthwright instance
function stealthwright(options = {}) {
  return new StealthWright(options);
}

// Export main components and utilities
module.exports = {
  stealthwright,
  errors
};