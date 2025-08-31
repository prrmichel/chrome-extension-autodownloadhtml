# Chrome Extension: Auto Download HTML, Screenshots, and Metadata

## Overview
This Chrome extension automatically saves the HTML, a full-page screenshot, and metadata (JSON) for every tab you visit.   
Screenshots are captured by scrolling through the page.   
Metadata includes the page URL, title, timestamp, and all links found on the page.

## Features
- **Automatic HTML download** : Saves the full HTML of each visited tab.
- **Full-page screenshots** : Captures the entire page, not just the visible area.
- **Metadata JSON** : Stores URL, title, timestamp, and all links from the page.

## How It Works
1. When a tab finishes loading, the extension:
   - Saves the HTML.
   - Captures full-page screenshots.
   - Extracts metadata and all links, then saves as JSON.
2. All files are downloaded automatically to your default download folder.

## Usage
- Browse as usual; files will be saved automatically for each tab.
- To manually trigger downloads, use the extension's messaging API (feature not tested).

### Usage with Messaging API
You can send a message to the extension to trigger the download process for the current tab. Here's an example of how to do this:   
The message types are: 
- `SAVE_HTML_FOR_TAB` : Saves the HTML of the current tab.
- `SAVE_SCREENSHOT_FOR_TAB` : Saves a full-page screenshot of the current tab.
- `SAVE_JSON_FOR_TAB` : Saves the metadata (URL, title, timestamp, links) of the current tab.
- `SAVE_ALL_FOR_TAB` : Saves HTML, screenshot, and metadata for the current tab.

## Permissions Required
- `downloads`: To save files automatically.
- `scripting`: To run scripts in tabs for HTML, screenshot, and link extraction.
