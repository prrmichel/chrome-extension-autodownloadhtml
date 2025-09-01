# Chrome Extension: Auto Download HTML, Screenshots, and Metadata

## Overview
This Chrome extension automatically saves the HTML, a full-page screenshot, and metadata (JSON) for every tab you visit.   
Screenshots are captured by scrolling through the page.   
Metadata includes the page URL, title, timestamp...

## Features
- **Automatic HTML download** : Saves the full HTML of each visited tab.
- **Full-page screenshots** : Captures the entire page, not just the visible area.
- **Metadata JSON** : Stores URL, title, timestamp, javascript files urls and all links from the page.
- **Customizable options** : Enable/disable automatic downloads by tab.
- **Keyboard shortcut** : Manually trigger downloads with Ctrl+Shift+X (Cmd+Shift+X on Mac).

## How It Works
1. When a tab finishes loading, the extension:
   - Saves the HTML.
   - Captures full-page screenshots.
   - Extracts metadata... then saves as JSON.
2. All files are downloaded automatically to your default download folder.

:warning: Sometimes, due to delays in page loading or dynamic content, the extension may not capture everything perfectly. You can manually trigger the download process using the keyboard shortcut.

## Usage
- Browse as usual. Files will be saved automatically for each tab.
  - :warning: You can disable automatic downloads in the extension options.
- To manually trigger downloads, you can use keyboard shortcut : Ctrl+Shift+X.
  - Mac: Command+Shift+X.
- To manually trigger downloads, use the extension's messaging API (feature not tested).

### Usage with Messaging API
You can send a message to the extension to trigger the download process for the current tab. Here's an example of how to do this:   
The message types are: 
- `SAVE_HTML_FOR_TAB` : Saves the HTML of the current tab.
- `SAVE_SCREENSHOT_FOR_TAB` : Saves a full-page screenshot of the current tab.
- `SAVE_METADATA_FOR_TAB` : Saves the metadata of the current tab.
- `SAVE_ALL_FOR_TAB` : Saves HTML, screenshot, and metadata for the current tab.

## Permissions Required
- `downloads`: To save files automatically.
- `scripting`: To run scripts in tabs for HTML, screenshot, and link extraction.
- `storage`: To save user preferences.
