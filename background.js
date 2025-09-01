// Save screenshot of the current tab
// Helper: get scroll info for the tab
async function getScrollInfoForTab(tabId) {
    const [result] = await chrome.scripting.executeScript({
        target: {tabId},
        func: () => {
            const doc = document.documentElement;
            const body = document.body;
            const scrollHeight = Math.max(doc.scrollHeight, body.scrollHeight);
            const clientHeight = doc.clientHeight || window.innerHeight;
            const scrollWidth = Math.max(doc.scrollWidth, body.scrollWidth);
            const clientWidth = doc.clientWidth || window.innerWidth;
            return {
                scrollHeight,
                clientHeight,
                scrollWidth,
                clientWidth,
                maxScrollY: Math.max(0, scrollHeight - clientHeight),
                maxScrollX: Math.max(0, scrollWidth - clientWidth)
            };
        }
    });
    return (result && result.result) || {};
}

// Helper: scroll to Y position in the tab
async function scrollToForTab(tabId, y) {
    await chrome.scripting.executeScript({
        target: {tabId},
        func: (scrollY) => { window.scrollTo({ top: scrollY, left: 0, behavior: 'instant' }); },
        args: [y]
    });
}

// Helper: delay
function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function captureVisibleTabWithRetry(maxRetries = 5) {
    let attempt = 0;
    let backoff = 300; // ms
    while (true) {
        try {
            const dataUrl = await new Promise((resolve, reject) => {
                chrome.tabs.captureVisibleTab(undefined, { format: 'png' }, (dataUrl) => {
                    if (chrome.runtime.lastError || !dataUrl) return reject(chrome.runtime.lastError || 'No dataUrl');
                    resolve(dataUrl);
                });
            });
            return dataUrl;
        } catch (err) {
            const msg = (err && (err.message || String(err))) || '';
            const quotaHit = msg.includes('MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND') || msg.includes('exceeds the MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND');
            if (quotaHit && attempt < maxRetries) {
                await delay(backoff);
                attempt++;
                backoff *= 2;
                continue;
            }
            throw err;
        }
    }
}

// Save full-page screenshot of the current tab
async function saveScreenshotForTab(tabId, tabUrl, timestamp, title) {
    try {
        const filenameBase = generateFilenameForTabUrl(title, timestamp, 'png');
        const scrollInfo = await getScrollInfoForTab(tabId);
        const steps = Math.max(1, Math.ceil(scrollInfo.scrollHeight / scrollInfo.clientHeight));
        const screenshots = [];
        let originalScrollY = 0;

        // Get original scroll position
        const [scrollRes] = await chrome.scripting.executeScript({
            target: { tabId },
            func: () => window.scrollY
        });
        originalScrollY = (scrollRes && scrollRes.result) || 0;

        // Throttle settings: ensure captures are spaced to avoid quota
        const captureIntervalMs = 700; // safe spacing between captureVisibleTab calls
        let lastCaptureTime = 0;

        for (let i = 0; i < steps; i++) {
            const y = Math.min(i * scrollInfo.clientHeight, scrollInfo.maxScrollY);
            await scrollToForTab(tabId, y);

            // allow paint / lazy-load
            await delay(250);

            // enforce minimum spacing between captures
            const now = Date.now();
            const sinceLast = now - lastCaptureTime;
            if (sinceLast < captureIntervalMs) {
                await delay(captureIntervalMs - sinceLast);
            }

            // capture with retry/backoff on quota errors
            const dataUrl = await captureVisibleTabWithRetry(5);
            lastCaptureTime = Date.now();

            screenshots.push({ y, dataUrl });
        }

        // Restore original scroll position
        await scrollToForTab(tabId, originalScrollY);

        // Save all screenshots (as separate files)
        const downloadIds = [];
        for (let i = 0; i < screenshots.length; i++) {
            const fname = screenshots.length === 1 ? filenameBase : `${filenameBase.replace(/\.png$/, '')}-part${i+1}.png`;
            try {
                const downloadId = await new Promise((resolve, reject) => {
                    chrome.downloads.download({ url: screenshots[i].dataUrl, filename: fname }, (id) => {
                        if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
                        resolve(id);
                    });
                });
                downloadIds.push(downloadId);
                // small pause to avoid download throttling
                await delay(100);
            } catch (err) {
                logError(`Failed to download screenshot part ${i+1} (${fname})`, err);
            }
        }

        console.log('Saved full-page screenshots for tab', tabId, 'as', downloadIds.length, 'files');
        return { success: true, downloadIds };
    } catch (err) {
        logError(`Error saving screenshot for tab ${tabId}`, err);
        return { success: false, error: err && err.message };
    }
}

function generateFilenameForTabUrl(title, timestamp, type) {
    const safeTitle = title.replace(/[^a-zA-Z0-9-_\.]/g, '_');
    return `${timestamp}-${safeTitle}.${type}`;
}

// Save HTML of the current tab
async function saveHtmlForTab(tabId, tabUrl, timestamp, title) {
    try {
        // Get both HTML from the page
        const [htmlResult] = await chrome.scripting.executeScript({
            target: {tabId},
            func: () => document.documentElement.outerHTML
        });
        const html = (htmlResult && htmlResult.result) || '';

        const filename = generateFilenameForTabUrl(title, timestamp, 'html');

        // Create a blob and try an object URL first (faster, avoids URL-length limits).
        const blob = new Blob([html], {type: 'text/html;charset=utf-8'});
        let objectUrl = null;
        try {
            objectUrl = URL.createObjectURL(blob);
        } catch (e) {
            // createObjectURL is not available in some worker/ServiceWorker contexts.
            console.warn('URL.createObjectURL unavailable, will fall back to data URL', e && e.message);
        }

        // Helper to perform the download and return the id
        const doDownload = (url) => new Promise((resolve, reject) => {
            chrome.downloads.download({url, filename}, (id) => {
                if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
                resolve(id);
            });
        });

        let downloadId = -1;
        if (objectUrl) {
            // Use object URL if available
            downloadId = await doDownload(objectUrl);
            // Revoke after a delay to let the download start
            setTimeout(() => {
                try {
                    URL.revokeObjectURL(objectUrl);
                } catch (e) { /* ignore */
                }
            }, 10000);
        } else {
            // Fallback: try a base64 data URL (smaller than percent-encoding for many inputs)
            try {
                const base64 = btoa(unescape(encodeURIComponent(html)));
                const dataUrl = 'data:text/html;base64,' + base64;
                downloadId = await doDownload(dataUrl);
            } catch (e) {
                // Last-resort fallback: percent-encoded data URL (may be very large)
                console.warn('Base64 encoding failed, falling back to percent-encoded data URL', e && e.message);
                const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
                downloadId = await doDownload(dataUrl);
            }
        }
        console.log('Saved HTML for tab', tabId, 'as', filename, 'downloadId', downloadId);
        return {success: true, downloadId};
    } catch (err) {
        logError(`Error saving HTML for tab ${tabId}`, err);
        return {success: false, error: err && err.message};
    }
}

async function getAllLinksForTab(tabId) {
    const [result] = await chrome.scripting.executeScript({
        target: {tabId},
        func: () => Array.from(document.querySelectorAll('a[href]')).map(a => ({
            href: a.href,
            text: a.textContent.trim()
        }))
    });
    return (result && result.result) || [];
}

async function getJsUrls(tabId) {
    const [result] = await chrome.scripting.executeScript({
        target: {tabId},
        func: () => {
            const urls = Array.from(document.querySelectorAll('script[src]'))
                .map(script => script.src)
                .filter(src => src && src.startsWith('https')
                );
            return Array.from(new Set(urls));
        }
    });
    return (result && result.result) || [];
}

// Save JSON metadata of the current tab
async function saveJsonForTab(tabId, tabUrl, timestamp, title) {
    try {
        const links = await getAllLinksForTab(tabId);
        const jsUrls = await getJsUrls(tabId);
        const metadata = {
            url: tabUrl,
            savedAt: timestamp,
            title: title,
            links: links,
            javascriptFilesUrls: jsUrls,
        };
        const filename = generateFilenameForTabUrl(title, timestamp, 'json');
        const jsonString = JSON.stringify(metadata, null, 2);
        let objectUrl = null;
        let downloadId = -1;
        let usedFallback = false;
        try {
            objectUrl = (typeof URL !== 'undefined' && URL.createObjectURL)
                ? URL.createObjectURL(new Blob([jsonString], {type: 'application/json'}))
                : null;
        } catch (e) {
            objectUrl = null;
        }
        const doDownload = (url) => new Promise((resolve, reject) => {
            chrome.downloads.download({url, filename}, (id) => {
                if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
                resolve(id);
            });
        });
        if (objectUrl) {
            downloadId = await doDownload(objectUrl);
            setTimeout(() => {
                try { URL.revokeObjectURL(objectUrl); } catch (e) {}
            }, 10000);
        } else {
            // Fallback: base64 data URL
            const base64 = btoa(unescape(encodeURIComponent(jsonString)));
            const dataUrl = 'data:application/json;base64,' + base64;
            downloadId = await doDownload(dataUrl);
            usedFallback = true;
        }
        console.log('Saved JSON for tab', tabId, 'as', filename, 'downloadId', downloadId, usedFallback ? '(data URL fallback)' : '');
        return {success: true, downloadId};
    } catch (err) {
        logError(`Error saving JSON for tab ${tabId}`, err);
        return {success: false, error: err && err.message};
    }
}

function formatTimestamp() {
    return new Date().toISOString()
        .replace(/[:.]/g, '')
        .replace(/-/g, '')
        .replace('T', '-')
        .replace('Z', '');
}

async function getTitleForTab(tabId) {
    const [titleResult] = await chrome.scripting.executeScript({
        target: {tabId},
        func: () => document.title
    });
    return (titleResult && titleResult.result) || 'Untitled';
}

// Listen for completed navigations and save the HTML
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (!(changeInfo.status === 'complete' && tab && tab.url && !tab.url.startsWith('chrome://'))) {
        return;
    }
    chrome.storage.sync.get(['autoExtractEnabled'], async (result) => {
        if (result.autoExtractEnabled === false) {
            // Disabled by user
            return;
        }
        const timestamp = formatTimestamp();
        const title = await getTitleForTab(tabId);
        saveHtmlForTab(tabId, tab.url, timestamp, title);
        saveScreenshotForTab(tabId, tab.url, timestamp, title);
        saveJsonForTab(tabId, tab.url, timestamp, title);
    });
});

// Listen for keyboard shortcut command to trigger extraction
chrome.commands.onCommand.addListener(async (command) => {
    if (command !== 'extract_now') {
        return;
    }
    chrome.tabs.query({active: true, currentWindow: true}, async (tabs) => {
        if (!tabs || !tabs.length) return;
        const tab = tabs[0];
        if (!tab.id || !tab.url || tab.url.startsWith('chrome://')) return;
        const tabId = tab.id;
        const timestamp = formatTimestamp();
        const title = await getTitleForTab(tabId);
        saveHtmlForTab(tabId, tab.url, timestamp, title);
        saveScreenshotForTab(tabId, tab.url, timestamp, title);
        saveJsonForTab(tabId, tab.url, timestamp, title);
    });
});

// Expose an explicit message-based API for manual triggers if needed
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    // if message type is not recognized, ignore
    if (!message || !message.type) return;
    // if message type is not a known type, ignore
    const validTypes = ['SAVE_HTML_FOR_TAB', 'SAVE_SCREENSHOT_FOR_TAB', 'SAVE_METADATA_FOR_TAB', 'SAVE_ALL_FOR_TAB'];
    if (!validTypes.includes(message.type)) return;

    const tabId = message.tabId || (sender && sender.tab && sender.tab.id);
    if (!tabId) return sendResponse({success: false, error: 'no tabId'});

    const tabUrl = message.tabUrl || (sender && sender.tab && sender.tab.url) || '';
    const timestamp = formatTimestamp();
    const title = await getTitleForTab(tabId);

    switch (message.type) {
        case 'SAVE_HTML_FOR_TAB':
            saveHtmlForTab(tabId, tabUrl, timestamp, title).then(sendResponse);
            return true;
        case 'SAVE_SCREENSHOT_FOR_TAB':
            saveScreenshotForTab(tabId, tabUrl, timestamp, title).then(sendResponse);
            return true;
        case 'SAVE_METADATA_FOR_TAB':
            saveJsonForTab(tabId, tabUrl, timestamp, title).then(sendResponse);
            return true;
        case 'SAVE_ALL_FOR_TAB':
            Promise.all([
                saveHtmlForTab(tabId, tabUrl, timestamp, title),
                saveScreenshotForTab(tabId, tabUrl, timestamp, title),
                saveJsonForTab(tabId, tabUrl, timestamp, title)
            ]).then(results => {
                sendResponse({
                    success: true,
                    results
                });
            }).catch(err => {
                sendResponse({success: false, error: err && err.message});
            });
            return true;
        default:
            return sendResponse({success: false, error: 'unknown message type'});
    }
});

function _serializeError(err) {
    if (!err) return String(err);
    if (err instanceof Error) return err.stack || err.message || String(err);
    try { return JSON.stringify(err); } catch (e) { return String(err); }
}

function logError(context, err) {
    try {
        const msg = (context ? context + ' - ' : '') + _serializeError(err);
        const runtimeErr = (chrome && chrome.runtime && chrome.runtime.lastError)
            ? ' | chrome.runtime.lastError: ' + _serializeError(chrome.runtime.lastError)
            : '';
        console.error(msg + runtimeErr);
    } catch (e) {
        try { console.log('LOG_ERROR_FALLBACK', context, _serializeError(err), e && _serializeError(e)); } catch (_) {}
    }
}
