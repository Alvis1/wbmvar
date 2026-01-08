# Project File Browser

A dynamic web page that displays all HTML files in the project folders with auto-update functionality.

## Features

- 📁 Displays all folders containing HTML files
- 📄 Lists all HTML files within each folder
- 🔄 Auto-refresh capability (updates every 5 seconds)
- 🎨 Beautiful, responsive design
- ⚡ Automatic file watching (detects when HTML files are added, renamed, or removed)

## Quick Start

### Option 1: Manual Updates

1. Generate the file listing:
   ```bash
   node generate-listing.js
   ```

2. Open `index.html` in your browser

3. Click "Refresh" button to manually update the listing

### Option 2: Auto-Watch Mode (Recommended)

1. Start the file watcher:
   ```bash
   node watch-files.js
   ```

2. Open `index.html` in your browser

3. Enable "Auto-refresh" checkbox in the browser

The watcher will automatically regenerate the file listing whenever HTML files are added, renamed, or removed. The browser will check for updates every 5 seconds.

## Files

- `index.html` - Main browser interface
- `generate-listing.js` - Generates the file listing JSON
- `watch-files.js` - Watches for file changes and auto-updates
- `files-listing.json` - Generated file listing (auto-created)

## How It Works

1. **File Watcher** (`watch-files.js`) monitors all folders for HTML file changes
2. When changes are detected, it runs `generate-listing.js` to update `files-listing.json`
3. The browser page periodically checks for updates to the JSON file
4. When updates are found, the page refreshes the display automatically

## Usage

- Click on any HTML file name to open it in a new tab
- Use the "Refresh" button for immediate updates
- Enable "Auto-refresh" for continuous monitoring
- The status bar shows the last update time

Press `Ctrl+C` in the terminal to stop the file watcher.
