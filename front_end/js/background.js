
import {
    NEW_TAB, isUdf,
    WebApiError, asyncWebApiToPromise, sendMessageToTab
} from "./utility.js";
import { DataManager, LocalStorageMemoryError, RequestManager } from "./data.js";

const CUR_LOCATION = "background.js";

const GALLERY_URL = chrome.runtime.getURL("./gallery.html");

const DEFAULT_EXTENSION_SETTINGS = {
    theme: "light",
    tagRules: []
};

const CONTEXT_MENU_OPTIONS = {
    title: "Bookmark",
    id: "Save",
    contexts: ["image", "video", "page"],
    documentUrlPatterns: [
        "http://*/*",
        "https://*/*",
        "data:image/*",
        "file://*"
    ]
};

let g_requester;
const g_popupInfo = Object.create(null);
let g_settings;

async function main() {
    g_requester = new RequestManager();

    try {
        const data = await DataManager.getKey("settings");

        g_settings = data.settings;
        if (isUdf(g_settings)) {
            g_settings = DEFAULT_EXTENSION_SETTINGS;
        }
    } catch (err) {
        if (err instanceof LocalStorageMemoryError) {
            console.warn("Failed to retrieve settings from local storage.");
            console.warn(err);

            g_settings = DEFAULT_EXTENSION_SETTINGS;
        } else {
            throw err;
        }
    }

    chrome.runtime.onMessage.addListener(handleRequest);

    chrome.browserAction.onClicked.addListener(openGallery);

    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create(CONTEXT_MENU_OPTIONS);
        chrome.contextMenus.onClicked.addListener(onContextClicked);
    });
}

function handleRequest(message, sender, sendResponse) {
    if (message.to !== CUR_LOCATION) return;

    let p;
    if (message.request === "get-popup-info") {
        p = collectPopupInfo(message.popupId, sender.tab);
    } else if (message.request === "get-tags") {
        p = g_requester.getTags();
    } else if (message.request === "get-meta") {
        p = g_requester.getContent();
    } else if (message.request === "add-content") {
        const content = message.content;

        if (message.addPageDetails === true) {
            const info = g_popupInfo[message.popupId];
            fillInSource(content, info);
        }

        replaceTags(content);
        p = g_requester.addContent(content);
    } else if (message.request === "find-content") {
        p = g_requester.findContent(message.id);
    } else if (message.request === "delete-content") {
        p = g_requester.deleteContent(message.id);
    } else if (message.request === "update-content") {
        replaceTags(message.info);
        p = g_requester.updateContent(message.id, message.info);
    } else if (message.request === "get-settings") {
        sendResponse(g_settings);
    } else if (message.request === "update-settings") {
        const updated = Object.assign({}, g_settings, message.settings);

        p = DataManager.setKey({ settings: updated })
        .then(() => {
            g_settings = updated;
        });
    } else {
        console.warn("Content script sent unknown message:", message);
    }

    if (!isUdf(p)) {
        p.then(sendResponse, sendResponse);
        return true;
    } else {
        return false;
    }
}

async function collectPopupInfo(popupId, tab) {
    const info = g_popupInfo[popupId];

    info.docUrl = tab.url;
    info.tags = await g_requester.getTags();

    const message = {
        to: "scanner.js",
        scan: true
    };
    info.scanInfo = await sendMessageToTab(tab.id, message);

    return info;
}

function fillInSource(content, info) {
    content.docUrl = info.docUrl;

    if (content.srcUrl === "srcUrl") {
        content.srcUrl = info.srcUrl;
    } else if (content.srcUrl === "docUrl") {
        content.srcUrl = info.docUrl;
    }
}

function replaceTags(content) {
    const rules = g_settings.tagRules;
    const tags = content.tags;
    if (rules && rules.length) {
        rules.forEach((r) => {
            const i = tags.findIndex(t => t === r.tag);
            if (i !== -1) {
                tags.splice(i, 1);
                tags.push.apply(tags, r.links);
            }
        });
    }
}

function openGallery(tab)
{
    const tabUrl = new URL(tab.url);
    const tabUrlWOQuery = tabUrl.origin + tabUrl.pathname;
    const fullGalleryUrl = GALLERY_URL + "?" + "theme=" + g_settings.theme;

    if (tab.url === NEW_TAB || tabUrlWOQuery === GALLERY_URL) {
        chrome.tabs.update(tab.id, {url: fullGalleryUrl});
    } else {
        chrome.tabs.create({url: fullGalleryUrl});
    }
}

function onContextClicked(info, tab) {
    const popupId = [
        tab.id,
        "popupId",
        Date.now()
    ].join("-");

    g_popupInfo[popupId] = {
        srcUrl: info.srcUrl,
        mediaType: info.mediaType
    };

    const to = "content.js";
    const tabId = tab.id;
    const message = {
        to,
        open: true,
        tabId,
        popupId,
        theme: g_settings.theme
    };

    loadScript(tabId, to, "./content.js")
    .then(() => sendMessageToTab(tabId, message));
}

function loadScript(tabId, to, script) {
    return sendMessageToTab(tabId, { to, check: true })
    .catch((err) => {
        if (err instanceof WebApiError) {
            return false;
        } else {
            throw err;
        }
    })
    .then((exists) => {
        if (exists !== true) {
            return asyncWebApiToPromise(
                (cb) => chrome.tabs.executeScript(tabId, { file: script }, cb)
            );
        }
    });
}

main();
