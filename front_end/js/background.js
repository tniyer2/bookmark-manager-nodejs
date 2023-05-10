
import { NEW_TAB, extend, isUdf } from "./utility.js";
import { DataManager, RequestManager } from "./data.js";

const GALLERY_URL = chrome.runtime.getURL("./gallery.html"),
    DEFAULT_SETTINGS = { theme: "light", tagRules: [] };
const CONTEXT_OPTIONS = {
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

let g_requester,
    g_popupInfo = {},
    g_settings;

async function main() {
    g_requester = new RequestManager();
    try {
        const data = await DataManager.getKey("settings");
        g_settings = data.settings || DEFAULT_SETTINGS;
    } catch (e) {
        if (e) console.warn(e);
        console.warn("Failed to retrieve settings from local storage.");
        g_settings = DEFAULT_SETTINGS;
    }

    chrome.runtime.onMessage.addListener(handleRequest);
    chrome.browserAction.onClicked.addListener(openGallery);
    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create(CONTEXT_OPTIONS);
        chrome.contextMenus.onClicked.addListener(onContextClicked);
    });
}

function handleRequest(msg, sender, sendResponse) {
    if (msg.to !== "background.js") {
        return;
    }

    const onErr = sendResponse;

    if (msg.request === "get-popup-info") {
        collectPopupInfo(msg.popupId, sender).then(sendResponse, onErr);
    } else if (msg.request === "get-tags") {
        g_requester.getTags().then(sendResponse, onErr);
    } else if (msg.request === "get-meta") {
        g_requester.getContent().then(sendResponse, onErr);
    } else if (msg.request === "add-content") {
        let info = g_popupInfo[msg.popupId];
        fillInSource(msg.info, info);

        replaceTags(msg.info);
        g_requester.addContent(msg.info).then(sendResponse, onErr);
    } else if (msg.request === "add-content-manually") {
        replaceTags(msg.info);
        g_requester.addContent(msg.info).then(sendResponse, onErr);
    } else if (msg.request === "find-content") {
        g_requester.findContent(msg.id).then(sendResponse, onErr);
    } else if (msg.request === "delete-content") {
        g_requester.deleteContent(msg.id).then(sendResponse, onErr);
    } else if (msg.request === "update-content") {
        replaceTags(msg.info);
        g_requester.updateContent(msg.id, msg.info).then(sendResponse, onErr);
    } else if (msg.request === "get-settings") {
        sendResponse(g_settings);
    } else if (msg.request === "update-settings") {
        const updatedSettings = extend(g_settings, msg.settings);
        DataManager.setKey({settings: updatedSettings}).then(() => {
            g_settings = updatedSettings;
            sendResponse();
        }).catch(onErr);
    } else {
        console.warn("Content script sent unknown message:", msg);
    }

    return true;
}

function collectPopupInfo(popupId, sender) {
    const info = g_popupInfo[popupId];
    info.docUrl = sender.tab.url;

    const scanInfoPromise = requestScanInfo(sender.tab.id);
    const tagsPromise = g_requester.getTags();

    return Promise.all([scanInfoPromise, tagsPromise])
    .then((results) => {
        if (isUdf(results)) {
            throw new Error("results is undefined.");
        }

        info.scanInfo = results[0];
        info.tags = results[1];

        return info;
    });
}

function fillInSource(content, info)
{
    content.docUrl = info.docUrl;

    if (content.srcUrl === "srcUrl")
    {
        content.srcUrl = info.srcUrl;
    }
    else if (content.srcUrl === "docUrl")
    {
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

function requestScanInfo(tabId) {
    return new Promise((resolve, reject) => {
        const message = {
            to: "scanner.js",
            scan: true
        };

        chrome.tabs.sendMessage(
            tabId,
            message,
            (scanInfo) => {
                const e = chrome.runtime.lastError;
                if (e) {
                    console.warn(e.message);
                    reject();
                } else {
                    resolve(scanInfo);
                }
            }
        );
    });
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

function onContextClicked(info, tab)
{
    let popupId = [tab.id, "popupId", Date.now()].join("-");
    g_popupInfo[popupId] = {
        srcUrl: info.srcUrl,
        mediaType: info.mediaType
    };

    let message = {
        to: "content.js",
        open: true,
        tabId: tab.id,
        popupId: popupId,
        theme: g_settings.theme
    };

    return onScriptLoad(tab.id, "content.js", "./content.js", message);
}

function onScriptLoad(tabId, to, script, message) {
    return new Promise((resolve) => {
        chrome.tabs.sendMessage(tabId, { to, check: true }, (exists) => {
            if (chrome.runtime.lastError) { /*ignore*/ }

            const send = () => {
                chrome.tabs.sendMessage(tabId, message, resolve);
            };

            if (exists === true) {
                send();
            } else {
                chrome.tabs.executeScript(tabId, { file: script }, send);
            }
        });
    });
}

main();
