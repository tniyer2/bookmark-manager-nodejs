
import { CSS_DIR, removeClass, addClass, getParams, injectThemeCss, getYoutubeEmbed, extend, preventBubble, makeRequest } from "./utility.js";
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

const cl_scrollbar = "customScrollbar1",
      show = (e) => removeClass(e, "noshow"),
      hide = (e) => addClass(e, "noshow");

const el_errorMessage = document.getElementById("error-message");

const el_sizer = document.getElementById("sizer");

const el_saveMenu = document.getElementById("save-menu"),
      el_url = el_saveMenu.querySelector("#url-input"),
      el_radioBox = el_saveMenu.querySelector("#radio-box"),
      el_title = el_saveMenu.querySelector("#title-input"),
      el_tagContainer = el_saveMenu.querySelector("#tag-container"),
      el_saveBtn = el_saveMenu.querySelector("#save-btn"),
      el_bookmarkBtn = el_saveMenu.querySelector("#bookmark-btn"),
      el_fgStart = el_saveMenu.querySelector("#focus-guard-start"),
      el_fgEnd = el_saveMenu.querySelector("#focus-guard-end");

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
    g_alerter,
    g_taggle,
    closePopup;

let g_noSourceAlert,
    g_noUrlAlert,
    g_invalidUrlAlert;

let g_source,
    g_docUrl,
    g_popupId,
    g_tabId;

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

function main()
{
    const params = getParams();
    const theme = params.get("theme") || "light";
    injectThemeCss(document.head, ["scrollbar", "alerts", "taggle", "popup"], theme, chrome.runtime.getURL(CSS_DIR));

    g_alerter = createAlerter();
    document.body.appendChild(g_alerter.alertList);

    TAGGLE_OPTIONS.alerter = g_alerter;
    TAGGLE_OPTIONS.inputFormatter = getTaggleInputFormatter(g_alerter);
    g_taggle = createTaggle(el_tagContainer, TAGGLE_OPTIONS);

    const queryInfo = {
        tabId: Number(params.get("tabId")),
        popupId: params.get("popupId"),
        manual: params.has("manual")
    };
    g_tabId = queryInfo.tabId;
    g_popupId = queryInfo.popupId;
    closePopup = queryInfo.manual ? closePopup2 : closePopup1;

    attachMaskEvents();

    if (queryInfo.manual) load2();
    else load();
    attachStyleEvents();
}

function load()
{
    makeRequest({
        request: "get-popup-info",
        popupId: g_popupId,
        to: "background.js"
    }).then((response) => {
        g_docUrl = response.docUrl;
        show(el_bookmarkBtn);
        show(el_saveMenu);
        createAutoComplete(g_taggle, el_tagContainer.parentElement, response.tags);
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
    makeRequest({request: "get-tags", to: "background.js"})
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
        createAutoComplete(g_taggle, el_tagContainer.parentElement, tags);
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

function genContentInfo()
{
    return {
        title: el_title.value.trim(),
        tags: g_taggle.getTags().values,
        date: Date.now()
    };
}

function attachSave()
{
    attachClick(el_saveBtn, save);
    attachClick(el_bookmarkBtn, () => {
        requestSave({ srcUrl: DEFAULT_BOOKMARK_ICON,
                      category: "bookmark" });
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

function requestSave(source)
{
    let info = extend(genContentInfo(), source);

    if (g_source)
    {
        info.duration = g_source.duration;
    }

    let message = {
        request: "add-content",
        info,
        popupId: g_popupId,
        to: "background.js"
    };

    requestSaveCommon(message);
}

function requestSaveManual(source)
{
    let info = extend(genContentInfo(), source);

    let message = {
        request: "add-content-manually",
        info,
        to: "background.js"
    };

    requestSaveCommon(message);
}

function requestSaveCommon(message) {
    makeRequest(message)
    .then((response) => {
        if (response.success) {
            closePopup();
        } else if (response.memoryError) {
            g_alerter.alert(MEMORY_ERROR_MESSAGE);
        } else {
            console.warn("could not handle response:", response);
            closePopup();
        }
    }).catch((err) => {
        console.warn("error saving content:", err);
        closePopup();
    });
}

function onNoLoad(err)
{
    console.log("error loading popup:", err);
    let textNode = document.createTextNode(NO_LOAD_MESSAGE);
    el_errorMessage.appendChild(textNode);
    show(el_errorMessage);
}

function closePopup1()
{
    if (g_tabId)
    {
        let message = { to: "content.js", close: true };
        chrome.tabs.sendMessage(g_tabId, message);
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
        g_noSourceAlert = g_alerter.alert(NO_SOURCE_MESSAGE);
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
            g_noUrlAlert = g_alerter.alert(NO_URL_MESSAGE);
            return true;
        }

        try {
            new URL(url);
        } catch (e) {
            g_invalidUrlAlert = g_alerter.alert(INVALID_URL_MESSAGE);
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
