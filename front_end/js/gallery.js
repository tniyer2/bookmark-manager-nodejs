
this.FeedBox = (function(){

	const DEFAULTS = { bufferSize: 20,
					   bufferOnScroll: { offset: 0,
					   					 delay: 0 } };
	return class {
		constructor(meta, el_parent, createContent, options)
		{
			this._meta = meta;
			this._queue = new Widgets.DOMQueue(el_parent);
			this._el_test = document.createElement("canvas");
			this._createContent = createContent;

			this._options = U.extend(DEFAULTS, options);

			this._onScroll = () => {
				this._checkIfReachedBottom();
			};

			if (this._options.bufferOnScroll)
			{
				this._attachOnScroll();
			}
		}

		buffer()
		{
			let len = this._meta.length;
			let initial = this._queue.count;
			let max = initial + this._options.bufferSize;

			while ( this._queue.count < len && 
				    this._queue.count < max )
			{
				let content = this._meta[this._queue.count];
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
			if (( window.innerHeight
				+ Math.ceil(window.pageYOffset + 1)
				+ this._options.bufferOnScroll.offset ) >= document.body.offsetHeight)
			{
				this._detachOnScroll();
				setTimeout(() => {
					this.buffer();
					this._attachOnScroll();
				}, this._options.bufferOnScroll.delay * 1000);
			}
		}
	};
})();

this.PopupManager = (function(){
	const POPUP_LINK = ApiUtility.getURL("html/popup.html") + "?manual=true"
	const el_popup = document.getElementById("popup");
	const cl_hide = "noshow";
	
	let instance;

	const Inner = class {
		open()
		{
			el_popup.addEventListener("load", () => {
				U.removeClass(el_popup, cl_hide);
			}, {once: true});
			el_popup.src = POPUP_LINK;
		}

		close()
		{
			U.addClass(el_popup, cl_hide);
		}
	};

	if (!instance)
	{
		instance = new Inner();
	}
	return instance;
})();

(function(){
	const DEFAULT_QUERY = "sort=!date",
		  SEARCH_BY_TAG = true,
		  NO_RESULTS_MESSAGE = "No search results.",
		  TUTORIAL_MESSAGE = "You can add content by opening the context menu on media, and bookmarks by opening it anywhere on a page. You can add by url by clicking the <svg><use href='#icon-save'/></svg> above.",
		  NO_LOAD_MESSAGE = "Something went wrong :(",
		  CONTENT_LINK = "singleView.html",
		  CONTENT_LINK_TARGET = "_self",
		  DEFAULT_TITLE = "untitled";

	const cl_hide = "noshow",
		  cl_searchBoxFocused = "focus",
		  cl_noLoad = "message",
		  cl_hover = "hover";

	const el_feed = document.getElementById("feed"),
		  el_feedMessage = el_feed.querySelector("#feed-message");

	const el_form = document.getElementById("search"),
		  el_searchBox = el_form.querySelector("#search-box"),
		  el_titleInput = el_form.querySelector("#title-input"),
		  el_tagContainer = el_form.querySelector("#tag-container"),
		  el_searchBy = el_form.querySelector("#searchby"),
		  [el_titleSvg, el_tagSvg] = el_searchBy.querySelectorAll("svg"),
		  el_searchByBtn = el_form.querySelector("#searchby-btn"),
		  el_date = el_form.querySelector("#date"),
		  el_category = el_form.querySelector("#category"),
		  el_sortBy = el_form.querySelector("#sortby"),
		  el_submit = el_form.querySelector("#submit");

	const el_saveBtn = document.getElementById("save-btn");

	const TAGGLE_OPTIONS = { placeholder: "search tags..." },
		  FEEDBOX_OPTIONS = {},
		  CONTENT_CREATOR_OPTIONS = { BEMBlock: "cc", maxHeight: 300, ignoreError: true };

	let g_taggle,
		g_searchBoxToggle,
		g_contentCreator,
		g_feedBox;

	let submitSearch = (function(){
		let g_submitted = false;
		
		return function() {
			if (g_submitted)
				return;
			else
				g_submitted = true;

			let queryString = makeQueryString();
			let cookie = makeCookie();

			let i = location.href.indexOf("?");
			let loc = location.href.substring(0, i);
			let redirect = loc + "?" + queryString + "&" + cookie;
			location.href = redirect;
		};
	})();

	function main()
	{
		U.injectThemeCss(document.head, ["scrollbar", "alerts", "taggle", "cc", "gallery", "feed"], "light", ApiUtility.cssDir);

		g_taggle = MyTaggle.createTaggle(el_tagContainer, TAGGLE_OPTIONS);
		g_searchBoxToggle = new Widgets.Toggle();
		g_contentCreator = new Widgets.ContentCreator(CONTENT_CREATOR_OPTIONS);

		attachSubmit();
		attachSave();
		g_searchBoxToggle.onToggleOn(switchToTags);
		g_searchBoxToggle.onToggleOff(switchToTitle);
		el_searchByBtn.addEventListener("click", (evt) => {
			g_searchBoxToggle.toggle();
		});

		load();
	}

	function load()
	{
		let {query, cookie} = parseQueryString();
		setSearch(query, cookie);
		addAwesomeFocusToSearchBox();
		loadContent(query);
	}

	function parseQueryString()
	{
		let queryString = location.search.substring(1);
		let i = queryString.lastIndexOf("&");
		let len = queryString.length;
		let query = queryString.substring(0, i);
		let cookie  = queryString.substring(i + 1, len);

		let q = query ? query : DEFAULT_QUERY;
		let map = Searcher.parse(q);

		return {cookie: cookie, query: map};
	}

	function setSearch(query, cookie)
	{
		if (query.title)
		{
			el_titleInput.value = query.title;
			g_searchBoxToggle.toggle(false);
		}
		else if (query.tags)
		{
			query.tags.forEach((tag) => {
				g_taggle.add(tag);
			});
			g_searchBoxToggle.toggle(true);
		}
		else
		{
			g_searchBoxToggle.toggle(SEARCH_BY_TAG);
			el_titleInput.value = "";
		}

		let indices = cookie.split("-").filter(o => o);
		if (indices.length === 3)
		{
			el_date.selectedIndex = indices[0];
			el_category.selectedIndex = indices[1];
			el_sortBy.selectedIndex = indices[2];
		}
	}

	async function loadContent(query)
	{
		let meta = await requestMeta().catch(() => {
			showMessage(NO_LOAD_MESSAGE);
		});
		if (U.isUdf(meta)) return;

		let results = Searcher.query(meta, query);
		g_feedBox = new FeedBox(results, el_feed, (info) => U.wrap(createContent, info), FEEDBOX_OPTIONS);
		if (!results.length)
		{
			let m = meta.length ? NO_RESULTS_MESSAGE : TUTORIAL_MESSAGE;
			showMessage(m);
		}
		else
		{
			g_feedBox.buffer();
		}

		let tags = await ApiUtility.makeRequest({request: "get-tags", to: "background.js"})
		.catch((err) => {
			console.log("error loading tags:", err);
		});
		if (!tags) return;

		MyTaggle.createAutoComplete(g_taggle, el_searchBox, tags);
	}

	function showMessage(message)
	{
		el_feedMessage.innerHTML = message;
		U.removeClass(el_feedMessage, cl_hide);
		el_feed.classList.add(cl_noLoad);
	}

	function requestMeta()
	{
		return ApiUtility.makeRequest({request: "get-meta", to: "background.js"}).then((response) => {
			if (response.local && response.app)
			{
				return response.local.meta.concat(response.app.meta);
			}
			else if (response.local)
			{
				return response.local.meta;
			}
			else if (response.app)
			{
				return response.app.meta;
			}
			else
			{
				console.warn("could not handle response:", response);
				throw new Error();
			}
		}).catch((err) => {
			console.warn("error loading content:", err);
			throw new Error();
		});
	}

	async function createContent(info, cb, onErr)
	{
		let el_contentBlock = document.createElement("div");
		el_contentBlock.classList.add("content");

		let el_sourceBlock = document.createElement("div");
		el_sourceBlock.classList.add("content__source-block");
		el_contentBlock.appendChild(el_sourceBlock);

		let el_infoBlock = document.createElement("div");
		el_infoBlock.classList.add("content__info-block");
		el_contentBlock.appendChild(el_infoBlock);

		let el_title = document.createElement("p");
		el_title.classList.add("content__title");

		let titleText = info.title ? info.title : DEFAULT_TITLE;
		let titleTextNode = document.createTextNode(titleText);
		el_title.appendChild(titleTextNode);
		el_infoBlock.appendChild(el_title);

		let el_content = await U.bindWrap(g_contentCreator.load, g_contentCreator, info).catch(onErr);
		if (U.isUdf(el_content)) return;

		let addHover = () => {
			U.addClass(el_contentBlock, cl_hover);
		};
		let removeHover = () => {
			U.removeClass(el_contentBlock, cl_hover);
		};
		el_contentBlock.addEventListener("mouseenter", addHover);
		el_contentBlock.addEventListener("mouseleave", removeHover);

		if (info.category === "bookmark")
		{
			U.preventBubble(el_content, "click");
			el_content.addEventListener("mouseenter", removeHover);
			el_content.addEventListener("mouseleave", addHover);
		}

		U.preventBubble(el_infoBlock, "click");

		el_sourceBlock.appendChild(el_content);

		let el_link = document.createElement("a");
		el_link.href = CONTENT_LINK + "?" + info.id;
		el_link.target = CONTENT_LINK_TARGET;
		el_link.classList.add("content-wrapper");
		el_link.appendChild(el_contentBlock);
		cb(el_link);
	}

	function makeQueryString()
	{
		let getSelected = (elm) => elm.options[elm.selectedIndex].value;
		let q = "";

		let title = el_titleInput.value.trim();
		let tags = g_taggle.getTags().values;
		if (title)
		{
			q += "&title=" + encodeURIComponent(title);
		}
		else if (tags.length)
		{
			q += "&tags=";
			for (let i = 0, l = tags.length; i < l; i+=1)
			{
				q += "+" + encodeURIComponent(tags[i]);
			}
		}

		let sortby = getSelected(el_sortBy);
		if (sortby)
		{
			q += "&sort=" + sortby;
		}

		let category = getSelected(el_category);
		if (category)
		{
			q += "&category=" + category;
		}

		let pastDays = getSelected(el_date);
		if (pastDays)
		{
			let pastMs = Number(pastDays) * 24 * 60 * 60 * 1000;
			let date = Date.now() - pastMs;
			q += "&date=x>" + date;
		}

		return q;
	}

	function makeCookie()
	{
		let cookie = `${el_date.selectedIndex}-${el_category.selectedIndex}-${el_sortBy.selectedIndex}`;
		return cookie;
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

		el_form.addEventListener("submit", (evt) => {
			evt.preventDefault();
		});
		el_submit.addEventListener("click", submitSearch, {once: true});

		onEnter(el_titleInput, submitSearch, () => el_titleInput.value);

		let taggleInput = g_taggle.getInput();
		onEnter(taggleInput, submitSearch, () => {
			return !taggleInput.value && g_taggle.getTags().values.length > 0;
		});
	}

	function attachSave()
	{
		el_saveBtn.addEventListener("click", () => {
			window.PopupManager.open();
		});
	}

	function addAwesomeFocusToSearchBox()
	{
		let o1 = { focusTarget: el_titleInput,
				   mouseTarget: el_searchBox,
				   disable: g_searchBoxToggle.toggled };
		let titleAf = Widgets.styleOnFocus(el_searchBox, cl_searchBoxFocused, o1);

		let o2 = { focusTarget: el_tagContainer,
				   mouseTarget: el_searchBox,
				   disable: !g_searchBoxToggle.toggled };
		let tagAf = Widgets.styleOnFocus(el_searchBox, cl_searchBoxFocused, o2);

		g_searchBoxToggle.onToggleOn(() => {
			titleAf.disable();
			tagAf.enable();
		});
		g_searchBoxToggle.onToggleOn(() => {
			tagAf.disable();
			titleAf.enable();
		});
	}

	function switchToTags()
	{
		U.addClass(el_titleInput, cl_hide);
		U.addClass(el_titleSvg, cl_hide);
		U.removeClass(el_tagContainer, cl_hide);
		U.removeClass(el_tagSvg, cl_hide);

		el_titleInput.value = "";
	}

	function switchToTitle()
	{
		U.addClass(el_tagContainer, cl_hide);
		U.addClass(el_tagSvg, cl_hide);
		U.removeClass(el_titleInput, cl_hide);
		U.removeClass(el_titleSvg, cl_hide);

		g_taggle.removeAll();
	}

	main();
})();
