// Storage utilities for Vercel serverless environment
// Uses /tmp for ephemeral storage (resets between cold starts)
const fs = require('fs').promises;
const path = require('path');

// Use /tmp on Vercel, local data directory otherwise
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV;
const BASE_DIR = isVercel ? '/tmp/data' : path.join(process.cwd(), 'data');

async function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (e) {
    // Ignore if already exists
  }
}

async function readJSON(filename, defaultValue = {}) {
  try {
    const filePath = path.join(BASE_DIR, filename);
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw || JSON.stringify(defaultValue));
  } catch (e) {
    return defaultValue;
  }
}

async function writeJSON(filename, data) {
  try {
    const filePath = path.join(BASE_DIR, filename);
    await ensureDir(filePath);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.warn(`Failed to write ${filename}:`, e.message);
    return false;
  }
}

// For activity logs - keep only recent entries
async function appendActivity(entry, maxEntries = 200) {
  const arr = await readJSON('activity.json', []);
  arr.unshift(entry);
  if (arr.length > maxEntries) arr.splice(maxEntries);
  await writeJSON('activity.json', arr);
}

module.exports = {
  readJSON,
  writeJSON,
  appendActivity,
  BASE_DIR,
  isVercel
};