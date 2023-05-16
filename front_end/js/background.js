
import {
    NEW_TAB, isUdf,
    WebApiError, asyncWebApiToPromise,
    sendMessageToTab, listenToOnMessage
} from "./utility.js";
import {
    getDataManager,
    getLocalStorageKeys, setLocalStorageKeys
} from "./data.js";

const GALLERY_URL = chrome.runtime.getURL("gallery.html");

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

let GLB_instance;
let GLB_settings;
const GLB_popupInfo = Object.create(null);

async function main() {
    GLB_instance = await getDataManager();

    try {
        const { settings } = await getLocalStorageKeys("settings");
        GLB_settings = settings;
    } finally {
        if (isUdf(GLB_settings)) {
            GLB_settings = DEFAULT_EXTENSION_SETTINGS;
        }
    }

    listenToOnMessage(handleRequest);

    chrome.browserAction.onClicked.addListener(openBookmarkGallery);

    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create(CONTEXT_MENU_OPTIONS);
        chrome.contextMenus.onClicked.addListener(onContextClicked);
    });
}

function handleRequest(message, sender) {
    switch (message.request) {
        case "get-popup-info":
            return collectPopupInfo(sender.tab);
        case "get-all-tags":
            return GLB_instance.allTags;
        case "get-all-content":
            return GLB_instance.allContent;
        case "add-content": {
            const content = message.content;

            if (message.addPageDetails === true) {
                fillInSource(content, GLB_popupInfo[sender.tab.id]);
            }

            applyTagRules(content);

            return GLB_instance.addContent(content);
        }
        case "find-content":
            return GLB_instance.findContent(message.id);
        case "delete-content":
            return GLB_instance.deleteContent(message.id);
        case "update-content":
            return GLB_instance.updateContent(message.id, message.updates);
        case "get-settings":
            return GLB_settings;
        case "update-settings": {
            const newSettings = Object.assign({}, GLB_settings, message.updates);

            return setLocalStorageKeys({
                settings: newSettings
            })
            .then(() => {
                GLB_settings = newSettings;
            });
        }
    }
}

async function collectPopupInfo(tab) {
    const info = GLB_popupInfo[tab.id];

    info.docUrl = tab.url;
    info.tags = GLB_instance.allTags;

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

    for (let i = 0; i < rules.length; ++i) {
        const rule = rules[i];

        const index = tags.indexOf(rule.inputTag);
        if (index !== -1) {
            tags.splice(index, 1, ...rule.outputTags);
        }
    }
}

function openBookmarkGallery(tab) {
    const url = `${GALLERY_URL}?theme=${GLB_settings.theme}`;

    if (tab.url === NEW_TAB) {
        chrome.tabs.update(tab.id, { url });
    } else {
        chrome.tabs.create({ url });
    }
}

function onContextClicked(info, tab) {
    const tabId = tab.id;

    GLB_popupInfo[tabId] = {
        srcUrl: info.srcUrl,
        mediaType: info.mediaType
    };

    const message = {
        request: "open-popup",
        tabId,
        theme: GLB_settings.theme
    };

    loadScript(tabId, "content.js")
    .then(() => sendMessageToTab(tabId, message));
}

function loadScript(tabId, script) {
    return sendMessageToTab(tabId, { request: "check-content-script-loaded" })
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
