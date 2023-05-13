
const NEW_TAB = "chrome://newtab/";
const CSS_DIR = "css";

class InvalidArgument extends Error {}

function rethrowAs(error, newErrorType) {
    return new newErrorType(error.message, { cause: error });
}

function noop() {} // eslint-disable-line no-empty-function

function isUdf(x) {
    return typeof x === "undefined";
}

function isString(x) {
    return typeof x === "string";
}

function isObject(x) {
    return typeof x === "object";
}

function isFunction(x) {
    return typeof x === "function";
}

function isNumber(x) {
    return typeof x === "number";
}

function minIfNumber(a, b) {
    let aIsNum = isNumber(a);
    let bIsNum = isNumber(b);

    if (aIsNum && bIsNum) {
        return Math.min(a, b);
    } else if (aIsNum) {
        return a;
    } else if (bIsNum) {
        return b;
    } else {
        return null;
    }
}

/**
 * Initializes an options argument with defaults
 * for options not supplied.
 */
function initOptions(options, defaults) {
    if (isUdf(options)) {
        options = {};
    } else if (!isObject(options)) {
        throw new InvalidArgument();
    }

    return Object.assign({}, defaults, options);
}

function joinFunctions(...functions) {
    functions = functions.filter(isFunction);

    return function(...args) {
        for (let i = 0; i < functions.length; ++i) {
            const f = functions[i];
            f(...args);
        }
    };
}

// parses a filename from a url.
// returns the filename or [name, .extension] if split is true.
const FILENAME_REGEX = /\w+(?:\.\w{3,4})+(?!.+\w+(?:\.\w{3,4})+)/;

function parseFileName(pathname, splitExtension) {
    const matches = pathname.match(FILENAME_REGEX);

    if (matches === null) return null;

    const match = matches[0];
    if (!splitExtension) return match;

    const i = match.lastIndexOf(".");
    const filename = match.substring(0, i);
    const extension = match.substring(i);

    return [filename, extension];
}

const YOUTUBE_EMBED_URL = "http://www.youtube.com/embed/";
const YOUTUBE_REGEX = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/i;

function getYoutubeEmbed(url) {
    const matches = url.match(YOUTUBE_REGEX);
    if (!matches) return null;

    const source = matches[1];
    if (!source) return null;

    return YOUTUBE_EMBED_URL + source;
}

function preventDefault(elm, eventnames) {
    const listener = (e) => { e.preventDefault(); };
    onEvents(elm, eventnames, listener);
}

function preventBubble(elm, eventnames) {
    const listener = (e) => { e.stopPropagation(); };
    onEvents(elm, eventnames, listener);
}

function onEvents(elm, eventnames, listener) {
    if (isString(eventnames)) {
        eventnames = [eventnames];
    } else if (!Array.isArray(eventnames)) {
        throw new InvalidArgument();
    }

    for (let i = 0; i < eventnames.length; ++i) {
        const e = eventnames[i];
        elm.addEventListener(e, listener);
    }
}

function addClass(elm, classname) {
    elm.classList.add(classname);
}

function removeClass(elm, classname) {
    elm.classList.remove(classname);
}

function createCssLinkElm(url) {
    const link = document.createElement("link");

    link.rel = "stylesheet";
    link.type = "text/css";
    link.href = url;

    return link;
}

function injectThemeCss(cssList, themeName) {
    const dir = chrome.runtime.getURL(CSS_DIR);

    for (let i = 0; i < cssList.length; ++i) {
        const css = cssList[i];
        const url = `${dir}/${css}-theme-${themeName}.css`;

        const link = createCssLinkElm(url);
        document.head.appendChild(link);
    }
}

function getURLSearchParams() {
    return new URLSearchParams(window.location.search);
}

class WebApiError extends Error {}

function asyncWebApiToPromise(apiCall) {
    return new Promise((resolve, reject) => {
        apiCall((...args) => {
            const e = chrome.runtime.lastError;
            if (e) {
                reject(new WebApiError(e.message));
            } else {
                resolve(...args);
            }
        });
    });
}

function sendMessage(message) {
    return asyncWebApiToPromise(
        (cb) => chrome.runtime.sendMessage(message, cb)
    );
}

function sendMessageToTab(tabId, message) {
    return asyncWebApiToPromise(
        (cb) => chrome.tabs.sendMessage(tabId, message, cb)
    );
}

export {
    NEW_TAB, CSS_DIR,
    InvalidArgument, rethrowAs,
    noop, isUdf, isNumber, isObject,
    minIfNumber,
    initOptions, joinFunctions,
    parseFileName,
    getYoutubeEmbed,
    preventDefault, preventBubble,
    addClass, removeClass, injectThemeCss,
    getURLSearchParams,
    WebApiError, asyncWebApiToPromise,
    sendMessage, sendMessageToTab
};
