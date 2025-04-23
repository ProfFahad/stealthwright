/**
 * StealthWright Errors Module
 * 
 * This module defines error classes used throughout the StealthWright library.
 * These error types match Playwright's error types for compatibility.
 */

/**
 * Base error class for StealthWright
 */
class StealthWrightError extends Error {
    constructor(message) {
      super(message);
      this.name = this.constructor.name;
      Error.captureStackTrace(this, this.constructor);
    }
  }
  
  /**
   * Timeout error
   */
  class TimeoutError extends StealthWrightError {
    constructor(message) {
      super(message || 'Operation timed out');
    }
  }
  
  /**
   * Navigation error
   */
  class NavigationError extends StealthWrightError {
    constructor(message) {
      super(message || 'Navigation failed');
    }
  }
  
  /**
   * Evaluation error
   */
  class EvaluationError extends StealthWrightError {
    constructor(message) {
      super(message || 'Evaluation failed');
    }
  }
  
  /**
   * Element not found error
   */
  class ElementNotFoundError extends StealthWrightError {
    constructor(selector) {
      super(`Element not found: ${selector}`);
      this.selector = selector;
    }
  }
  
  /**
   * Browser launch error
   */
  class BrowserLaunchError extends StealthWrightError {
    constructor(message) {
      super(message || 'Failed to launch browser');
    }
  }
  
  /**
   * Protocol error
   */
  class ProtocolError extends StealthWrightError {
    constructor(message) {
      super(message || 'Protocol error');
    }
  }
  
  /**
   * Browser closed error
   */
  class BrowserClosedError extends StealthWrightError {
    constructor() {
      super('Browser has been closed');
    }
  }
  
  module.exports = {
    StealthWrightError,
    TimeoutError,
    NavigationError,
    EvaluationError,
    ElementNotFoundError,
    BrowserLaunchError,
    ProtocolError,
    BrowserClosedError,
    errors: {
      TimeoutError,
      NavigationError,
      EvaluationError,
      ElementNotFoundError,
      BrowserLaunchError,
      ProtocolError,
      BrowserClosedError
    }
  };