/**
 * Chrome Executable Finder
 * 
 * This module helps locate Chrome/Chromium executable on various platforms.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, execFileSync } = require('child_process');

/**
 * Locations where Chrome might be installed on macOS
 */
const macOSChromePaths = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
];

/**
 * Locations where Chrome might be installed on Windows
 */
const windowsChromePaths = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
  'C:\\Program Files (x86)\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
];

/**
 * Commands to find Chrome on Linux
 */
const linuxChromeCommands = [
  'google-chrome',
  'google-chrome-stable',
  'google-chrome-unstable',
  'chromium',
  'chromium-browser',
  'microsoft-edge',
  'brave-browser',
];

/**
 * Try to run which command to find executable path
 * @param {string} command - Command to find
 * @returns {string|null} - Path to executable or null
 */
function which(command) {
  try {
    return execSync(`which ${command}`, { stdio: 'pipe' }).toString().trim();
  } catch (error) {
    return null;
  }
}

/**
 * Check if a file exists and is executable
 * @param {string} filePath - Path to check
 * @returns {boolean} - Whether file exists and is executable
 */
function canExecute(filePath) {
  try {
    if (!fs.existsSync(filePath)) return false;
    
    // Check if file is executable on Unix systems
    if (process.platform !== 'win32') {
      try {
        fs.accessSync(filePath, fs.constants.X_OK);
        return true;
      } catch (error) {
        return false;
      }
    }
    
    // On Windows we just check if it exists
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Find Chrome on macOS
 * @returns {string|null} - Path to Chrome or null
 */
function findChromeOnMacOS() {
  // First try from env or config
  if (process.env.CHROME_PATH && canExecute(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }
  
  // Check standard locations
  for (const chromePath of macOSChromePaths) {
    if (canExecute(chromePath)) {
      return chromePath;
    }
  }
  
  // Try to use mdfind to locate Chrome
  try {
    const installations = execSync(
      'mdfind "kMDItemCFBundleIdentifier == \'com.google.Chrome\'"'
    ).toString().trim().split('\n');
    
    if (installations.length) {
      const chromePath = path.join(installations[0], '/Contents/MacOS/Google Chrome');
      if (canExecute(chromePath)) {
        return chromePath;
      }
    }
  } catch (error) {
    // Ignore errors
  }
  
  return null;
}

/**
 * Find Chrome on Windows
 * @returns {string|null} - Path to Chrome or null
 */
function findChromeOnWindows() {
  // First try from env or config
  if (process.env.CHROME_PATH && canExecute(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }
  
  // Check standard locations
  for (const chromePath of windowsChromePaths) {
    if (canExecute(chromePath)) {
      return chromePath;
    }
  }
  
  // Try to find Chrome in Program Files
  const prefixes = [
    process.env['PROGRAMFILES(X86)'],
    process.env.PROGRAMFILES,
    process.env.LOCALAPPDATA,
  ].filter(Boolean);

  for (const prefix of prefixes) {
    try {
      const directories = fs.readdirSync(prefix);
      for (const dir of directories) {
        if (dir.includes('Chrome') || dir.includes('Microsoft') || dir.includes('Brave')) {
          const chromePath = path.join(prefix, dir, 'Application', dir.includes('Edge') ? 'msedge.exe' : dir.includes('Brave') ? 'brave.exe' : 'chrome.exe');
          if (canExecute(chromePath)) {
            return chromePath;
          }
        }
      }
    } catch (error) {
      // Ignore errors
    }
  }

  return null;
}

/**
 * Find Chrome on Linux
 * @returns {string|null} - Path to Chrome or null
 */
function findChromeOnLinux() {
  // First try from env or config
  if (process.env.CHROME_PATH && canExecute(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }
  
  // Try using which to find Chrome
  for (const command of linuxChromeCommands) {
    const chromePath = which(command);
    if (chromePath && canExecute(chromePath)) {
      return chromePath;
    }
  }

  // Check common locations
  const commonPaths = [
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
    '/usr/bin/microsoft-edge',
    '/usr/bin/brave-browser',
  ];

  for (const chromePath of commonPaths) {
    if (canExecute(chromePath)) {
      return chromePath;
    }
  }

  return null;
}

/**
 * Get Chrome executable path based on platform
 * @returns {string|null} - Path to Chrome or null
 */
function getChromePath() {
  switch (process.platform) {
    case 'darwin':
      return findChromeOnMacOS();
    case 'win32':
      return findChromeOnWindows();
    case 'linux':
      return findChromeOnLinux();
    default:
      console.warn(`Unsupported platform: ${process.platform}`);
      return null;
  }
}

module.exports = {
  getChromePath,
};