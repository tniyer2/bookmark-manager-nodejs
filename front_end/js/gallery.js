
import {
    isUdf, initOptions,
    preventDefault, preventBubble,
    addClass, removeClass, injectThemeCss,
    getURLSearchParams, sendMessage
} from "./utility.js";
import { createTaggle, createAutoComplete } from "./myTaggle.js";
import { DOMQueue, Toggle, ContentCreator, styleOnFocus } from "./widgets.js";
import { searchContent, SINGLE_VALUE_KEYS, MULTI_VALUE_KEYS } from "./searchContent.js";

const FEEDBOX_DEFAULTS = {
    bufferSize: 20,
    bufferOnScroll: {
        offset: 0,
        delay: 0
    }
};

class FeedBox {
    constructor(allContent, el_parent, makeContent, options) {
        options = initOptions(options, FEEDBOX_DEFAULTS);
        this._options = options;

        this._allContent = allContent;
        this._queue = new DOMQueue(el_parent);
        this._el_test = document.createElement("canvas");
        this._createContent = makeContent;

        this._onScroll = () => {
            this._checkIfReachedBottom();
        };

        if (this._options.bufferOnScroll) {
            this._attachOnScroll();
        }
    }

    buffer()
    {
        let len = this._allContent.length;
        let initial = this._queue.count;
        let max = initial + this._options.bufferSize;

        while (this._queue.count < len && this._queue.count < max)
        {
            let content = this._allContent[this._queue.count];
            let insert = this._queue.next();

            this._createContent(content)
            .then((elm) => {
                insert(elm);
            }).catch((err) => {
                if (err)
                {
                    console.warn(err);
                }
                console.warn("could not load content:", content);
            });
        }
    }

    _attachOnScroll()
    {
        window.addEventListener("scroll", this._onScroll);
    }

    _detachOnScroll()
    {
        window.removeEventListener("scroll", this._onScroll);
    }

    _checkIfReachedBottom()
    {
        const windowOffsetHeight =
            window.innerHeight
            + Math.ceil(window.pageYOffset + 1)
            + this._options.bufferOnScroll.offset;

        if (windowOffsetHeight >= document.body.offsetHeight)
        {
            this._detachOnScroll();
            setTimeout(() => {
                this.buffer();
                this._attachOnScroll();
            }, this._options.bufferOnScroll.delay * 1000);
        }
    }
}

const POPUP_LINK = chrome.runtime.getURL("popup.html");
const el_popup = document.getElementById("popup");
const cl_hide = "noshow";

class PopupManager {
    open(searchParams) {
        const url = new URL(POPUP_LINK);
        url.search = searchParams;
        el_popup.src = url;

        el_popup.addEventListener("load", () => {
            removeClass(el_popup, cl_hide);
        }, { once: true });
    }

    close() {
        addClass(el_popup, cl_hide);
    }
}

if (!window.PopupManager) {
    window.PopupManager = new PopupManager();
}

const DEFAULT_SEARCH_BY_TAGS = true;
const NO_RESULTS_MESSAGE = "No search results.";
const TUTORIAL_MESSAGE = "You can add content by opening the context menu on a page, an image, or a video. You can add by url by clicking the <svg><use href='#icon-save'/></svg> above.";
const NO_LOAD_MESSAGE = "Something went wrong :(";
const CONTENT_LINK = "singleView.html";
const CONTENT_LINK_TARGET = "_self";
const DEFAULT_TITLE = "untitled";
const CSS_FILES = ["scrollbar", "alerts", "taggle", "cc", "gallery", "feed"];

const cl_searchBoxFocused = "focus";
const cl_noLoad = "message";
const cl_hover = "hover";

const el_feed = document.getElementById("feed");
const el_feedMessage = el_feed.querySelector("#feed-message");

const el_form = document.getElementById("search");
const el_searchBox = el_form.querySelector("#search-box");
const el_titleInput = el_form.querySelector("#title-input");
const el_tagContainer = el_form.querySelector("#tag-container");
const el_searchBy = el_form.querySelector("#searchby");
const [el_titleSvg, el_tagSvg] = el_searchBy.querySelectorAll("svg");
const el_searchByBtn = el_form.querySelector("#searchby-btn");
const el_date = el_form.querySelector("#date");
const el_category = el_form.querySelector("#category");
const el_sortBy = el_form.querySelector("#sortby");
const el_submit = el_form.querySelector("#submit");

const el_saveBtn = document.getElementById("save-btn");

const TAGGLE_OPTIONS = { placeholder: "search tags..." };
const FEEDBOX_OPTIONS = {};
const CONTENT_CREATOR_OPTIONS = {
    BEMBlock: "cc",
    maxHeight: 300,
    ignoreError: true
};

let g_taggle;
let g_searchBoxToggle;
let g_contentCreator;
let g_feedBox;

const DEFAULT_THEME = "light";
let g_theme;

let GLB_submitted = false;
function submitSearch() {
    if (GLB_submitted) return;

    GLB_submitted = true;

    location.search = makeSearchParams();
}

function makeSearchParams() {
    const searchParams = new URLSearchParams();

    const title = el_titleInput.value.trim();
    const tags = g_taggle.getTags().values;

    if (title.length > 0) {
        searchParams.set("title", title);
    } else if (tags.length > 0) {
        for (const tag of tags) {
            searchParams.append("tags", tag);
        }
    }

    const sortby = el_sortBy.value;
    if (sortby.length > 0) {
        searchParams.append("sort", sortby);
    }

    let categories = el_category.value;
    if (categories.length > 0) {
        categories = categories.split(" ");
        for (const category of categories) {
            searchParams.append("category", category);
        }
    }

    const pastDays = el_date.value;
    if (pastDays) {
        const pastMs = Number(pastDays) * 24 * 60 * 60 * 1000;
        let date = Date.now() - pastMs;
        date = "x>" + String(date);

        searchParams.append("date", date);
    }

    return searchParams;
}

function main() {
    persistSelectState([
        [el_date, "search-date"],
        [el_category, "search-category"],
        [el_sortBy, "search-sortby"]
    ]);

    const searchParams = getURLSearchParams();

    g_theme = searchParams.get("theme");
    if (g_theme === null) {
        g_theme = DEFAULT_THEME;
    }
    injectThemeCss(CSS_FILES, g_theme);

    g_taggle = createTaggle(el_tagContainer, TAGGLE_OPTIONS);
    g_searchBoxToggle = new Toggle();
    g_contentCreator = new ContentCreator(CONTENT_CREATOR_OPTIONS);

    attachSubmit();

    el_saveBtn.addEventListener("click", () => {
        const params = new URLSearchParams();
        params.append("manual", true);
        params.append("theme", g_theme);

        window.PopupManager.open(params);
    });

    g_searchBoxToggle.onToggleOn(switchToTags);
    g_searchBoxToggle.onToggleOff(switchToTitle);
    el_searchByBtn.addEventListener("click", (evt) => {
        g_searchBoxToggle.toggle();
    });

    updateSearchUI(searchParams);
    addAwesomeFocusToSearchBox();

    const query = getQuery(searchParams);
    loadContent(query);
}

function persistSelectState(elements) {
    window.addEventListener("load", () => {
        for (let i = 0; i < elements.length; ++i) {
            const [element, storageKey] = elements[i];

            const index = sessionStorage.getItem(storageKey);
            if (index !== null) {
                element.selectedIndex = index;
            }
        }
    }, { once: true });

    for (let i = 0; i < elements.length; ++i) {
        const [element, storageKey] = elements[i];

        element.addEventListener("change", () => {
            sessionStorage.setItem(storageKey, element.selectedIndex);
        });
    }
}

function updateSearchUI(searchParams) {
    if (searchParams.has("title")) {
        el_titleInput.value = searchParams.get("title");

        g_searchBoxToggle.toggle(false);
    } else if (searchParams.has("tags")) {
        const tags = searchParams.getAll("tags");
        for (let i = 0; i < tags.length; ++i) {
            g_taggle.add(tags[i]);
        }

        g_searchBoxToggle.toggle(true);
    } else {
        el_titleInput.value = "";
        g_searchBoxToggle.toggle(DEFAULT_SEARCH_BY_TAGS);
    }
}

function getQuery(searchParams) {
    const query = Object.create(null);

    for (const key of searchParams.keys()) {
        if (SINGLE_VALUE_KEYS.includes(key)) {
            query[key] = searchParams.get(key);
        } else if (MULTI_VALUE_KEYS.includes(key)) {
            query[key] = searchParams.getAll(key);
        }
    }

    return query;
}

async function loadContent(query) {
    const allContent = await sendMessage({
        request: "get-all-content"
    }).catch((err) => {
        console.warn("Error loading content:", err);
        showMessage(NO_LOAD_MESSAGE);
    });
    if (isUdf(allContent)) return;

    const searchResults = searchContent(allContent, query);
    g_feedBox = new FeedBox(
        searchResults,
        el_feed,
        createContent,
        FEEDBOX_OPTIONS
    );

    if (searchResults.length === 0) {
        let message;
        if (allContent.length === 0) {
            message = TUTORIAL_MESSAGE;
        } else {
            message = NO_RESULTS_MESSAGE;
        }

        showMessage(message);
    } else {
        g_feedBox.buffer();
    }

    const tags = await sendMessage({
        request: "get-all-tags"
    }).catch((err) => {
        console.warn("Error loading tags:", err);
    });
    if (isUdf(tags)) return;

    createAutoComplete(g_taggle, el_searchBox, tags);
}

function showMessage(message) {
    el_feedMessage.innerHTML = message;
    removeClass(el_feedMessage, cl_hide);
    addClass(el_feed, cl_noLoad);
}

function createContent(content) {
    let el_contentBlock = document.createElement("div");
    addClass(el_contentBlock, "content");
    
    let el_sourceBlock = document.createElement("div");
    addClass(el_sourceBlock, "content__source-block");
    el_contentBlock.appendChild(el_sourceBlock);
    
    let el_infoBlock = document.createElement("div");
    addClass(el_infoBlock, "content__info-block");
    el_contentBlock.appendChild(el_infoBlock);
    
    let el_title = document.createElement("p");
    addClass(el_title, "content__title");
    
    let titleText = content.title ? content.title : DEFAULT_TITLE;
    let titleTextNode = document.createTextNode(titleText);
    el_title.appendChild(titleTextNode);
    el_infoBlock.appendChild(el_title);
    
    return g_contentCreator.load(content)
    .then((el_content) => {
        if (isUdf(el_content)) {
            throw new Error("el_content is undefined.");
        }
        
        let addHover = () => {
            addClass(el_contentBlock, cl_hover);
        };
        let removeHover = () => {
            removeClass(el_contentBlock, cl_hover);
        };
        el_contentBlock.addEventListener("mouseenter", addHover);
        el_contentBlock.addEventListener("mouseleave", removeHover);
        
        if (content.category === "bookmark") {
            preventBubble(el_content, "click");
            el_content.addEventListener("mouseenter", removeHover);
            el_content.addEventListener("mouseleave", addHover);
        }
        
        preventBubble(el_infoBlock, "click");
        
        el_sourceBlock.appendChild(el_content);
        
        const el_link = document.createElement("a");
        const query = "id=" + content.id + "&theme=" + g_theme;
        el_link.href = CONTENT_LINK + "?" + query;
        el_link.target = CONTENT_LINK_TARGET;
        addClass(el_link, "content-wrapper");
        el_link.appendChild(el_contentBlock);

        return el_link;
    });
}

function attachSubmit()
{
    function onEnter(elm, callback, condition)
    {
        elm.addEventListener("keydown", (evt) => {
            if (evt.key === "Enter" && condition())
            {
                callback();
            }
        });
    }

    preventDefault(el_form, "submit");
    el_submit.addEventListener("click", submitSearch, {once: true});

    onEnter(el_titleInput, submitSearch, () => el_titleInput.value);

    let taggleInput = g_taggle.getInput();
    onEnter(taggleInput, submitSearch, () => {
        return !taggleInput.value && g_taggle.getTags().values.length > 0;
    });
}

function addAwesomeFocusToSearchBox()
{
    let o1 = {
        focusTarget: el_titleInput,
        mouseTarget: el_searchBox,
        disable: g_searchBoxToggle.toggled
    };
    let titleAf = styleOnFocus(el_searchBox, cl_searchBoxFocused, o1);

    let o2 = {
        focusTarget: el_tagContainer,
        mouseTarget: el_searchBox,
        disable: !g_searchBoxToggle.toggled
    };
    let tagAf = styleOnFocus(el_searchBox, cl_searchBoxFocused, o2);

    g_searchBoxToggle.onToggleOn(() => {
        titleAf.disable();
        tagAf.enable();
    });
    g_searchBoxToggle.onToggleOn(() => {
        tagAf.disable();
        titleAf.enable();
    });
}

function switchToTags() {
    addClass(el_titleInput, cl_hide);
    addClass(el_titleSvg, cl_hide);

    removeClass(el_tagContainer, cl_hide);
    removeClass(el_tagSvg, cl_hide);

    el_titleInput.value = "";
}

function switchToTitle() {
    addClass(el_tagContainer, cl_hide);
    addClass(el_tagSvg, cl_hide);

    removeClass(el_titleInput, cl_hide);
    removeClass(el_titleSvg, cl_hide);

    g_taggle.removeAll();
}

main();
