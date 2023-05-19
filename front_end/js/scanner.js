
import { listenToOnMessage } from "./utility.js";

const FOCUSED_URL_PRIORITY = 5;

let g_lastClickedElement;

const YOUTUBE_EMBED_URL = "http://www.youtube.com/embed/";
const YOUTUBE_REGEX = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/i;

function getYoutubeEmbed(url) {
    let matches = url.match(YOUTUBE_REGEX);
    
    if (!matches || !matches[1]) {
        return null;
    }

    let source = YOUTUBE_EMBED_URL + matches[1];
    return source;
}

function main() {
    document.documentElement.addEventListener("mouseup", (e) => {
        const rightButtonUp = e.button === 2;
        if (rightButtonUp) {
            g_lastClickedElement = e.target;
        }
    });

    listenToOnMessage((message) => {
        switch (message.request) {
            case "scan": {
                const scanInfo = scanPage();

                // console.log("Page was scanned for videos:", scanInfo);
                return scanInfo;
            }
        }
    });
}

function scanPage() {
    let youtube = findYoutube();
    if (youtube) {
        return { single: youtube };
    }

    let final = scan(document.documentElement);

    if (g_lastClickedElement) {
        findUnderElement(g_lastClickedElement, final, (found) => {
            found.priority += FOCUSED_URL_PRIORITY;
        });
    }
    g_lastClickedElement = null;

    if (isValid(document.href)) {
        final.push({
            url: document.href,
            title: document.title,
            priority: 0
        });
    }

    mySort(final);

    return { list: final };
}

function scan(root) {
    let urls = concat(
        findAllOf(root, ".mp4"),
        findAllOf(root, ".flv"),
        findAllOf(root, ".mov"),
        findByLinkElm(root),
        findByVideoElm(root)
    );

    mySort(urls);

    removeDuplicates(urls, "url", (o1, o2) => {
        return o1.priority < o2.priority;
    });

    return urls;
}

function findUnderElement(element, urls, callback) {
    let docHtml = document.documentElement.outerHTML;
    let html = element.outerHTML;

    let start = docHtml.indexOf(html);
    let end  = start + html.length;

    for (let i = 0; i < urls.length; i+=1) {
        if (urls[i].start >= start && urls[i].start < end) {
            callback(urls[i]);
        }
    }
}

function mySort(urls) {
    urls = urls.sort((o1, o2) => {
        if (o1.priority === o2.priority) {
            return o1.start - o2.start;
        } else {
            return o2.priority - o1.priority;
        }
    });
}

function findYoutube() {
    const href = document.location.href;

    if (href.indexOf("://www.youtube.com") <= 0) {
        return null;
    }

    const source = getYoutubeEmbed(href);
    const h1 = document.querySelector("h1").firstChild.innerText;

    return { url: source, title: h1 };
}

const VIDEO_PRIORITY = 3;
function findByVideoElm(root) {
    let sources = [];

    let a = root.getElementsByTagName("video");
    for (let i = 0; i < a.length; i+=1) {
        let link = a[i];
        let url = null;

        if (link.src) {
            url = isValid(link.src);
        }
        if (!url && link.hasAttribute("data-thumb")) {
            url = myTrim(link.getAttribute("data-thumb"));

            if (url.indexOf("http") == -1) {
                url = isValid("http:" + url);
            }
        }

        let title = "";
        if (link.hasAttribute("alt")) {
            title = myTrim(link.getAttribute("alt"));
        } else if (link.hasAttribute("title")) {
            title = myTrim(link.getAttribute("title"));
        }

        if (!title) {
            title = document.title;
        }

        addUrl(url, title, root.outerHTML.indexOf(link.outerHTML));

        let elms = link.querySelectorAll("source");
        elms.forEach((elm) => {
            let src = isValid(elm.src);
            if (src) {
                addUrl(src, title, root.outerHTML.indexOf(elm.outerHTML));
            }
        });
    }

    function addUrl(url, title, start) {
        if (url) {
            sources.push({
                url: url,
                title: title,
                start: start,
                priority: VIDEO_PRIORITY
            });
        }
    }

    return sources;
}

const LINK_PRIORITY = 2;
function findByLinkElm(root) {
    let sources = [];

    let links = root.querySelectorAll("a");
    for (let i = 0; i < links.length; i+=1) {
        let link = links[i];
        let url = isValid(link.href);

        if (url) {
            let title = "";
            if (link.hasAttribute("title")) {
                title = myTrim(link.getAttribute("title"));
            }
            if (!title && link.hasAttribute("alt")) {
                title = myTrim(link.getAttribute("alt"));
            }
            if (!title) {
                title = myTrim(link.innerText);
            }
            if (!title) {
                title = document.title;
            }

            sources.push({
                url,
                title,
                start: root.outerHTML.indexOf(link.outerHTML),
                priority: LINK_PRIORITY
            });
        }
    }

    return sources;
}

const SEARCH_PRIORITY = 1;
function findAllOf(root, ext) {
    let html = root.outerHTML;
    let sources = [];

    let start = 0;
    while (true) {
        let i = html.indexOf(ext, start);
        if (i === -1) {
            break;
        }

        start = i + ext.length;

        let dq = html.indexOf("\"", i);
        let sq = html.indexOf("\'", i);
        let character = null;
        let c_end;
        if (dq > i && sq > i) {
            if (dq > sq) {
                character = "\'";
                c_end = sq;
            } else {
                character = "\"";
                c_end = dq;
            }
        } else if (dq > i) {
            character = "\"";
            c_end = dq;
        } else if (sq > i) {
            character = "\'";
            c_end = sq;
        } else {
            continue;
        }

        let s = html.substr(c_end - 300, 300);
        let c_start = s.lastIndexOf(character);
        if (c_start < 0) {
            continue;
        }

        s = s.substr(c_start + 1);

        s = isValid(s);
        if (s) {
            add(s, c_start);
        }
    }

    function add(s, c_start) {
        sources.push({
            url: s,
            title: document.title,
            start: c_start,
            priority: SEARCH_PRIORITY
        });
    }

    return sources;
}

function removeDuplicates(urls, prop, pref) {
    urls = urls.sort((o1, o2) => o1.url.localeCompare(o2.url));
    for (let i = urls.length - 1; i > 0; i-=1) {
        if (urls[i][prop] === urls[i-1][prop]) {
            let j;
            if (pref && pref(urls[i], urls[i-1])) {
                j = i;
            } else {
                j = i-1;
            }
            urls.splice(j, 1);
        }
    }
}

function concat(...arrs) {
    let final = [];
    for (let arr of arrs) {
        final = final.concat(arr);
    }
    return final;
}

function isValid(url) {
    if (typeof url !== "string") {
        return false;
    }
    if (url.indexOf("blob:") === 0) {
        return false;
    }
    if (url.indexOf("http://") === -1
        && url.indexOf("https://") === -1) {
        return false;
    }
    if (url.indexOf(".mp4") === -1
        && url.indexOf(".flv") === -1
        && url.indexOf(".mov") === -1) {
        return false;
    }

    url = url.replace(/&amp;/g, "&");

    return url;
}

function myTrim(txt) {
    let trimmed = !txt ? "" : txt.replace(/^[\s_]+|[\s_]+$/gi, '').replace(/(_){2,}/g, "_");
    return trimmed;
}

main();
