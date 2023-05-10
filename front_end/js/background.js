
import { NEW_TAB, extend, wrap, bindWrap, isUdf, makeTag } from "./utility.js";
import { DataManager, RequestManager } from "./data.js";

(function(){
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

    return async function() {
        g_requester = new RequestManager();
        try {
            const data = await DataManager.getKeyWrapper("settings");
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
    };

    function handleRequest(msg, sender, sendResponse)
    {
        if (msg.to !== "background.js")
        {
            return;
        }

        let onErr = sendResponse;

        if (msg.request === "get-popup-info")
        {
            collectPopupInfo(msg.popupId, sender, sendResponse, onErr);
        }
        else if (msg.request === "get-tags")
        {
            g_requester.getTags(sendResponse, onErr);
        }
        else if (msg.request === "get-meta")
        {
            g_requester.getContent(sendResponse, onErr);
        }
        else if (msg.request === "add-content")
        {
            let info = g_popupInfo[msg.popupId];
            fillInSource(msg.info, info);

            replaceTags(msg.info);
            g_requester.addContent(msg.info, sendResponse, onErr);
        }
        else if (msg.request === "add-content-manually")
        {
            replaceTags(msg.info);
            g_requester.addContent(msg.info, sendResponse, onErr);
        }
        else if (msg.request === "find-content")
        {
            g_requester.findContent(msg.id, sendResponse, onErr);
        }
        else if (msg.request === "delete-content")
        {
            g_requester.deleteContent(msg.id, sendResponse, onErr);
        }
        else if (msg.request === "update-content")
        {
            replaceTags(msg.info);
            g_requester.updateContent(msg.id, msg.info, sendResponse, onErr);
        }
        else if (msg.request === "get-settings")
        {
            sendResponse(g_settings);
        }
        else if (msg.request === "update-settings")
        {
            const updatedSettings = extend(g_settings, msg.settings);
            DataManager.setKeyWrapper({settings: updatedSettings}).then(() => {
                g_settings = updatedSettings;
                sendResponse();
            }).catch(onErr);
        }
        else
        {
            console.warn("Content script sent unknown message:", msg);
        }

        return true;
    }

    async function collectPopupInfo(popupId, sender, cb, onErr)
    {
        let info = g_popupInfo[popupId];
        info.docUrl = sender.tab.url;

        let scanInfoPromise = wrap(requestScanInfo, sender.tab.id);
        let tagsPromise = bindWrap(g_requester.getTags, g_requester);
        let all = Promise.all([scanInfoPromise, tagsPromise]);
        let results = await all.catch(onErr);
        if (isUdf(results)) return;

        info.scanInfo = results[0];
        info.tags = results[1];

        cb(info);
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

    function requestScanInfo(tabId, cb, onErr)
    {
        chrome.tabs.sendMessage(tabId, {to: "scanner.js", scan: true}, (scanInfo) => {
            const e = chrome.runtime.lastError;
            if (e)
            {
                console.warn(e.message);
                onErr();
            }
            else
            {
                cb(scanInfo);
            }
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
        let popupId = makeTag(tab.id, "popupId");
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
        onScriptLoad(tab.id, "content.js", "./content.js", message);
    }

    function onScriptLoad(tabId, to, script, message, cb)
    {
        chrome.tabs.sendMessage(tabId, {to: to, check: true}, (exists) => {
            if (chrome.runtime.lastError) { /*ignore*/ }
            let send = () => {
                chrome.tabs.sendMessage(tabId, message, cb);
            };

            if (exists === true)
            {
                send();
            }
            else
            {
                chrome.tabs.executeScript(tabId, {file: script}, send);
            }
        });
    }
})()();
