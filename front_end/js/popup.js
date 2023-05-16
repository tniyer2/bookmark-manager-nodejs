
import {
    preventBubble, getYoutubeEmbed,
    removeClass, addClass, injectThemeCss,
    getURLSearchParams, sendMessage, sendMessageToTab,
    SendMessageError
} from "./utility.js";
import { RadioManager, ListManager, AwesomeAlerter, styleOnFocus } from "./widgets.js";
import { createTaggle, createAutoComplete } from "./myTaggle.js";

const getTaggleInputFormatter = (function(){
    const RESERVED_KEYS = ['*', '!'];
    const getMessage = (character) => `'${character}' is a reserved character`;
    const REGEX = RegExp(`[${RESERVED_KEYS.join("")}]`, 'g');

    function Inner(input)
    {
        input.addEventListener("input", () => {
            input.value = input.value.replace(REGEX, "");
        });
        input.addEventListener("keydown", (evt) => {
            if (RESERVED_KEYS.includes(evt.key))
            {
                if (this._alert)
                {
                    this._alert.removeImmediately();
                }

                this._alert = this._alerter.alert(getMessage(evt.key));
            }
        });
    }

    return function(alerter) {
        let context = { _alerter: alerter };
        return Inner.bind(context);
    };
})();

const DEFAULT_BOOKMARK_ICON = chrome.runtime.getURL("svgs/defaultIcon.svg");

const NO_LOAD_MESSAGE = "Popup couldn't load. Try refreshing the page.",
      NO_SOURCE_MESSAGE = "Pick a source first.",
      NO_URL_MESSAGE = "Enter a url in the url field.",
      INVALID_URL_MESSAGE = "Url entered is not a valid url.",
      MEMORY_ERROR_MESSAGE = "No more data left in chrome storage. Download the desktop app for extra storage.";

const cl_scrollbar = "customScrollbar1";
const cl_hide = "noshow";
const show = e => removeClass(e, cl_hide);
// const hide = e => addClass(e, cl_hide);

const el_errorMessage = document.getElementById("error-message");

const el_sizer = document.getElementById("sizer");

const el_saveMenu = document.getElementById("save-menu"),
      el_url = el_saveMenu.querySelector("#url-input"),
      el_radioBox = el_saveMenu.querySelector("#radio-box"),
      el_title = el_saveMenu.querySelector("#title-input"),
      el_tagContainer = el_saveMenu.querySelector("#tag-container"),
      el_saveBtn = el_saveMenu.querySelector("#save-btn"),
      el_bookmarkBtn = el_saveMenu.querySelector("#bookmark-btn");

const el_sourceMenu = document.getElementById("source-menu");

const TAGGLE_OPTIONS = {
    placeholder: "tags...",
    tabIndex: 0
};

const ALERTER_OPTIONS = {
    duration: 5,
    insertAtTop: false
};

let g_radioManager,
    GLB_alerter,
    GLB_taggle,
    closePopup;

let g_noSourceAlert,
    g_noUrlAlert,
    g_invalidUrlAlert;

let g_source = null;
let g_docUrl;
let GLB_tabId;

let onUrlChange = (function(){
    let lock = new Object();

    return function(evt) {
        if (isYoutube(evt.target.value))
        {
            g_radioManager.disable(lock);
        }
        else
        {
            g_radioManager.enable(lock);
        }
    };
})();

function main() {
    const params = getURLSearchParams();

    const theme = params.get("theme") || "light";
    injectThemeCss(["scrollbar", "alerts", "taggle", "popup"], theme);

    GLB_alerter = createAlerter();
    document.body.appendChild(GLB_alerter.alertList);

    TAGGLE_OPTIONS.alerter = GLB_alerter;
    TAGGLE_OPTIONS.inputFormatter = getTaggleInputFormatter(GLB_alerter);
    GLB_taggle = createTaggle(el_tagContainer, TAGGLE_OPTIONS);

    GLB_tabId = Number(params.get("tabId"));

    const manual = params.has("manual");
    
    closePopup = manual ? closePopup2 : closePopup1;

    attachMaskEvents();

    if (manual) {
        load2();
    } else {
        load();
    }

    attachStyleEvents();
}

function load() {
    sendMessage({
        request: "get-popup-info"
    }).then((response) => {        
        g_docUrl = response.docUrl;
        show(el_bookmarkBtn);
        show(el_saveMenu);
        createAutoComplete(GLB_taggle, el_tagContainer.parentElement, response.tags);
        createSourceList(
            response.srcUrl,
            g_docUrl,
            response.scanInfo,
            response.mediaType === "image"
        );
        attachSave();
    }).catch(onNoLoad);
}

function load2()
{
    sendMessage({
        request: "get-all-tags"
    })
    .then((tags) => {
        show(el_radioBox);
        let radioInputs = el_radioBox.querySelectorAll("label input");
        g_radioManager = new RadioManager(radioInputs);
        show(el_url.parentElement);
        el_url.addEventListener("change", onUrlChange);

        show(el_saveBtn);
        show(el_bookmarkBtn);
        attachHideRadio();

        show(el_saveMenu);
        createAutoComplete(GLB_taggle, el_tagContainer.parentElement, tags);
        attachManualSave();
    }).catch(onNoLoad);
}

function isYoutube(url)
{
    try {
        let urlObject = new URL(url);
        return urlObject.hostname === "www.youtube.com";
    } catch (e) {
        return false;
    }
}

function attachSave()
{
    attachClick(el_saveBtn, save);
    attachClick(el_bookmarkBtn, () => {
        requestSave({
            srcUrl: DEFAULT_BOOKMARK_ICON,
            category: "bookmark"
        });
    });
}

function attachManualSave()
{
    attachClick(el_saveBtn, getManualSave((url) => {
        let category;
        if (isYoutube(url))
        {
            category = "youtube";
            url = getYoutubeEmbed(url);
        }
        else
        {
            category = g_radioManager.selected.value;
        }

        requestSaveManual({
            srcUrl: url,
            category
        });
    }));
    attachClick(el_bookmarkBtn, getManualSave((url) => {
        requestSaveManual({
            docUrl: url,
            srcUrl: DEFAULT_BOOKMARK_ICON,
            category: "bookmark"
        });
    }));
}

function attachHideRadio()
{
    el_bookmarkBtn.addEventListener("mouseenter", () => {
        g_radioManager.disable();
    });
    el_bookmarkBtn.addEventListener("mouseleave", () => {
        g_radioManager.enable();
    });
}

const requestSaveManual = s => _requestSave(s, false);
const requestSave = s => _requestSave(s, true);

function _requestSave(source, addPageDetails) {
    let content = {
        title: el_title.value.trim(),
        tags: GLB_taggle.getTags().values,
        date: Date.now()
    };
    content = Object.assign(content, source);

    if (addPageDetails && g_source !== null) {
        content.duration = g_source.duration;
    }

    const message = {
        request: "add-content",
        addPageDetails,
        content
    };

    return sendMessage(message)
    .catch((err) => {
        if (err instanceof SendMessageError
            && err.type === "LocalStorageMemoryError") {
            GLB_alerter.alert(MEMORY_ERROR_MESSAGE);
        } else {
            throw err;
        }
    })
    .finally(() => {
        closePopup();
    });
}

function onNoLoad(err)
{
    console.warn("error loading popup:", err);
    let textNode = document.createTextNode(NO_LOAD_MESSAGE);
    el_errorMessage.appendChild(textNode);
    show(el_errorMessage);
}

function closePopup1() {
    if (GLB_tabId) {
        sendMessageToTab(GLB_tabId, { request: "close-popup" });
    }
}

function closePopup2()
{
    window.parent.PopupManager.close();
}

function createSourceList(srcUrl, docUrl, scanInfo, isImage)
{
    let setMeta = (li, data) => {

        g_source = {
            url: data.srcUrl,
            category: data.category
        };

        if (!el_title.value)
        {
            el_title.value = data.title;
        }

        if (g_noSourceAlert)
        {
            g_noSourceAlert.remove();
        }

        if (data.category === "video")
        {
            if (data.sourceMeta && data.sourceMeta.duration)
            {
                g_source.duration = data.sourceMeta.duration;
            }
        }
    };
    let manager = new ListManager(
        el_sourceMenu,
        {
            BEMBlock: "source-menu",
            selectFirst: false,
            onSelect: setMeta
        }
    );
    manager.el_list.classList.add(cl_scrollbar);

    if (isImage)
    {
        show(el_saveBtn);
        // show(el_sourceMenu);

        let options = {
            title: "source clicked on",
            type: "image",
            showDimensions: true,
            data: {
                srcUrl: "srcUrl",
                category: "image",
                title: ""
            }
        };
        manager.addSource(srcUrl, options);
        setMeta(null, options.data);

        if (srcUrl === docUrl)
        {
            return;
        }
    }

    if (scanInfo.list && scanInfo.list.length)
    {
        show(el_saveBtn);
        show(el_sourceMenu);
        attachResizeEvents();

        scanInfo.list.forEach((video) => {
            let options = {
                title: video.title,
                type: "video",
                showDimensions: true,
                data: {
                    srcUrl: video.url,
                    category: "video",
                    title: video.title
                }
            };
            manager.addSource(video.url, options);
        });
    }
    else if (scanInfo.single)
    {
        show(el_saveBtn);

        let video = scanInfo.single;
        setMeta(null, {
            srcUrl: video.url,
            category: "youtube",
            title: video.title
        });
    }
}

function createAlerter()
{
    let a = new AwesomeAlerter(ALERTER_OPTIONS);
    preventBubble(a.alertList, ["click", "mousedown", "mouseup"]);
    return a;
}

function attachMaskEvents()
{
    let eventName = "mousedown";
    let stopBubble = (evt) => { evt.stopPropagation(); };
    el_saveMenu.addEventListener(eventName, stopBubble);
    el_sourceMenu.addEventListener(eventName, stopBubble);
    document.documentElement.addEventListener(eventName, closePopup);
}

function attachClick(elm, cb)
{
    function inner()
    {
        elm.addEventListener("click", (evt) => {
            if (cb(evt) === true)
            {
                inner();
            }
        }, {once: true});
    }
    inner();
}

function save()
{
    if (g_noSourceAlert)
    {
        g_noSourceAlert.removeImmediately();
    }

    if (g_source)
    {
        requestSave({
            srcUrl: g_source.url,
            category: g_source.category
        });
    }
    else
    {
        g_noSourceAlert = GLB_alerter.alert(NO_SOURCE_MESSAGE);
        return true;
    }
}

function getManualSave(cb)
{
    return () => {
        if (g_noUrlAlert) g_noUrlAlert.removeImmediately();
        if (g_invalidUrlAlert) g_invalidUrlAlert.removeImmediately();

        let url = el_url.value.trim();
        if (!url)
        {
            g_noUrlAlert = GLB_alerter.alert(NO_URL_MESSAGE);
            return true;
        }

        try {
            new URL(url);
        } catch (e) {
            g_invalidUrlAlert = GLB_alerter.alert(INVALID_URL_MESSAGE);
            return true;
        }

        return cb(url);
    };
}

function attachResizeEvents()
{
    let onResize = () => {
        let b1 = el_saveMenu.getBoundingClientRect();
        let b2 = el_sourceMenu.getBoundingClientRect();

        let hdiff = Math.abs(b1.height - b2.height) / 2;
        let tdiff = Math.abs(b1.top - b2.top);

        if (hdiff === tdiff)
        {
            show(el_sizer);
        }
        else
        {
            show(el_sizer);
        }
    };
    onResize();
    window.addEventListener("resize", onResize);
}

function attachStyleEvents()
{
    styleOnFocus(el_url.parentElement, "focus", {target: el_url});
    styleOnFocus(el_title.parentElement, "focus", {target: el_title});
    styleOnFocus(el_tagContainer, "focus", {target: el_tagContainer});
}

main();
