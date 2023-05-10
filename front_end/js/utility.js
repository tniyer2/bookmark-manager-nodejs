
const NEW_TAB = "chrome://newtab/";
const CSS_DIR = "css";

function noop(){} // eslint-disable-line no-empty-function

function isUdf(arg) {
    return typeof arg === "undefined";
}

function min(a, b) {
    let q = typeof a === "number";
    let p = typeof b === "number";
    let final = q && p ? Math.min(a, b):
                q ? a:
                p ? b:
                null;
    return final;
}

// @return concatenation of arguments and current date.
function makeTag() {
    let arr = Array.from(arguments);
    arr.push(Date.now());
    return arr.join("-");
}

// wraps f(...args, resolve, reject) in a Promise
function wrap(f, ...args) {
    return new Promise((resolve, reject) => {
        f(...args, resolve, reject);
    });
}

function bindWrap(f, context, ...args) {
    return wrap(f.bind(context), ...args);
}

// @return an array of funcs bound to context
function bindAll(context, ...funcs) {
    return funcs.map(f => f.bind(context));
}

function extend() {
    var master = {};
    for (var i = 0, l = arguments.length; i < l; i+=1) {
        var object = arguments[i];
        for (var key in object) {
            if (object.hasOwnProperty(key)) {
                master[key] = object[key];
            }
        }
    }
    return master;
}

// only use this for functions that don't return.
function joinCallbacks(...cbs) {
    cbs = cbs.filter(Boolean);

    return (...args) => {
        cbs.forEach((f) => {
            f(...args);
        });
    };
}

function removeDuplicates(arr, sorter) {
    arr.sort(sorter);
    for (let i = arr.length - 1; i >= 0; i-=1)
    {
        let a = arr[i];
        let b = arr[i-1];
        if ((sorter && sorter(a, b) === 0) || a === b)
        {
            arr.splice(i, 1);
        }
    }
    return arr;
}

function getRandomDate(days) {
    let rand = Math.random() * days;
    let offset = rand * 24 * 60 * 60 * 1000;
    return Date.now() - offset;
}

// parses a filename from a url.
// @return the filename or [name, .extension] if split is true.
const rgx = /\w+(?:\.\w{3,4})+(?!.+\w+(?:\.\w{3,4})+)/;

function parseFileName(pathname, split) {
    let matches = pathname.match(rgx);

    if (matches && matches.length > 0)
    {
        let match = matches[0];

        if (split)
        {
            let p = match.lastIndexOf(".");
            return [match.substring(0, p), match.substring(p)];
        }
        else
        {
            return match;
        }
    }
    else
    {
        return null;
    }
}

const YOUTUBE_EMBED_URL = "http://www.youtube.com/embed/";
const YOUTUBE_REGEX = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/i;

function getYoutubeEmbed(url) {
    let matches = url.match(YOUTUBE_REGEX);
    if (!matches || !matches[1])
    {
        return null;
    }
    let source = YOUTUBE_EMBED_URL + matches[1];
    return source;
}

function preventBubble(elm, eventnames) {
    _eventUtility(elm, eventnames, (evt) => {
        evt.stopPropagation();
    });
}

function preventDefault(elm, eventnames) {
    _eventUtility(elm, eventnames, (evt) => {
        evt.preventDefault();
    });
}

function _eventUtility(elm, eventnames, cb) {
    if (eventnames.constructor !== Array)
    {
        eventnames = [eventnames];
    }

    eventnames.forEach((n) => {
        elm.addEventListener(n, cb);
    });
}

function addClass(elm, classname) {
    if (!elm.classList.contains(classname))
    {
        elm.classList.add(classname);
    }
}

function removeClass(elm, classname) {
    if (elm.classList.contains(classname))
    {
        elm.classList.remove(classname);
    }
}

function show(elm) {
    removeClass(elm, "noshow");
}

function hide(elm) {
    addClass(elm, "noshow");
}

function injectCss(elm, url) {
    let link  = document.createElement("link");
    link.rel  = "stylesheet";
    link.type = "text/css";
    link.href = url;
    elm.appendChild(link);
}

function injectThemeCss(elm, cssList, theme, dir) {
    cssList.forEach((css) => {
        let url = dir + "/" + css + "-theme-" + theme + ".css";
        injectCss(elm, url);
    });
}

function getParams() {
    return new URLSearchParams(document.location.search.substring(1));
}

function makeRequest(request) {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage(request, (response, reject) => {
            const e = chrome.runtime.lastError;
            if (e) {
                console.warn(e.message);
                reject();
            } else {
                resolve(response);
            }
        });
    });
}

export {
    NEW_TAB,
    CSS_DIR,
    noop,
    isUdf,
    min,
    makeTag,
    wrap,
    bindWrap,
    bindAll,
    extend,
    joinCallbacks,
    removeDuplicates,
    getRandomDate,
    parseFileName,
    getYoutubeEmbed,
    preventBubble,
    preventDefault,
    addClass,
    removeClass,
    show,
    hide,
    injectCss,
    injectThemeCss,
    getParams,
    makeRequest
};
