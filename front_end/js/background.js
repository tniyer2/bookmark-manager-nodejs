
import {
    NEW_TAB, isUdf,
    WebApiNoResponse, asyncWebApiToPromise,
    sendMessageToTab, listenToOnMessage,
    rethrowAs
} from "./utility.js";
import { DataManager, LocalStorageMemoryError, RequestManager } from "./data.js";

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
let GLB_settings;

async function main() {
    g_requester = new RequestManager();

    try {
        const data = await DataManager.getKey("settings");

        if (isUdf(data.settings)) {
            GLB_settings = DEFAULT_EXTENSION_SETTINGS;
        } else {
            GLB_settings = data.settings;
        }
    } catch (err) {
        if (err instanceof LocalStorageMemoryError) {
            GLB_settings = DEFAULT_EXTENSION_SETTINGS;

            rethrowAs(err, LoadSettingsError);
        } else {
            throw err;
        }
    }

    listenToOnMessage(handleRequest);

    chrome.browserAction.onClicked.addListener(openGallery);

    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create(CONTEXT_MENU_OPTIONS);
        chrome.contextMenus.onClicked.addListener(onContextClicked);
    });
}

class LoadSettingsError extends Error {}

function handleRequest(message, sender) {
    switch (message.request) {
        case "get-popup-info":
            return collectPopupInfo(message.popupId, sender.tab);
        case "get-tags":
            return g_requester.getTags();
        case "get-meta":
            return g_requester.getContent();
        case "add-content": {
            const content = message.content;

            if (message.addPageDetails === true) {
                fillInSource(content, g_popupInfo[message.popupId]);
            }

            applyTagRules(content);

            return g_requester.addContent(content);
        }
        case "find-content":
            return g_requester.findContent(message.id);
        case "delete-content":
            return g_requester.deleteContent(message.id);
        case "update-content":
            return g_requester.updateContent(message.id, message.info);
        case "get-settings":
            return GLB_settings;
        case "update-settings": {
            const newSettings = Object.assign(GLB_settings, message.updates);

            return DataManager.setKey({
                settings: newSettings
            })
            .then(() => {
                GLB_settings = newSettings;
            });
        }
    }
}

async function collectPopupInfo(popupId, tab) {
    const info = g_popupInfo[popupId];

    info.docUrl = tab.url;
    info.tags = await g_requester.getTags();

    info.scanInfo = await sendMessageToTab(tab.id, { request: "scan" });

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

/*
Applies a tag rule by replacing a tag
with its corresponding values.
*/
function applyTagRules(content) {
    const rules = GLB_settings.tagRules;
    const tags = content.tags;

    if (!rules) return;

    for (let i = 0; i < rules.length; ++i) {
        const rule = rules[i];

        const index = tags.indexOf(rule.tag);
        if (index !== -1) {
            tags.splice(index, 1);
            tags.push(...rule.links);
        }
    }
}

function openGallery(tab) {
    const tabUrl = new URL(tab.url);
    const tabUrlWithoutQuery = tabUrl.origin + tabUrl.pathname;
    const fullGalleryUrl = `${GALLERY_URL}?theme=${GLB_settings.theme}`;

    if (tab.url === NEW_TAB || tabUrlWithoutQuery === GALLERY_URL) {
        chrome.tabs.update(tab.id, { url: fullGalleryUrl });
    } else {
        chrome.tabs.create({ url: fullGalleryUrl });
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

    const tabId = tab.id;
    const message = {
        request: "open-popup",
        tabId,
        popupId,
        theme: GLB_settings.theme
    };

    loadScript(tabId, "./content.js")
    .then(() => sendMessageToTab(tabId, message));
}

function loadScript(tabId, script) {
    return sendMessageToTab(tabId, { request: "check-content-script-loaded" })
    .catch((err) => {
        if (err instanceof WebApiNoResponse) {
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
