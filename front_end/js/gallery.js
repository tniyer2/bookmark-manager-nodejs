 
// Toggle
this.Toggle = (function(){
	const pushArgs = (arr, args) => {
		arr.push.apply(arr, args);
	};
	const callEach = (arr) => { 
		arr.forEach((cb) => { cb(); });
	};

	return class {
		constructor()
		{
			this._toggleOnQueue = [];
			this._toggleOffQueue = [];
			this._toggled = false;
		}

		get toggled()
		{
			return this._toggled;
		}

		onToggleOn()
		{
			pushArgs(this._toggleOnQueue, arguments);
		}

		onToggleOff()
		{
			pushArgs(this._toggleOffQueue, arguments);
		}

		dispatchToggleOn()
		{
			callEach(this._toggleOnQueue);
		}

		dispatchToggleOff()
		{
			callEach(this._toggleOffQueue);
		}

		toggle(optionalToggled)
		{
			if (!U.isUdf(optionalToggled))
			{
				this._toggled = optionalToggled;
			}

			this._toggle();
			this._toggled = !this._toggled;
		}

		_toggle()
		{
			if (this._toggled)
			{
				this.dispatchToggleOn();
			}
			else
			{
				this.dispatchToggleOff();
			}
		}
	};
})();

// FeedBox
this.FeedBox = (function(){

	const CONTENT_LINK  = "singleView.html";
	const DEFAULT_TITLE = "untitled";
	const cl_hover = "hover";
	const stopBubble = (evt) => {
		evt.stopPropagation();
	};

	const DEFAULTS = { bufferSize: 20,
					   bufferOnScroll: { offset: 0,
					   					 delay: 0 }};
	return class {
		constructor(meta, el_parent, options)
		{
			this._meta = meta;
			this._queue = new Widgets.DOMQueue(el_parent);
			this._el_test = document.createElement("canvas");

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

				this._createContent(content, (elm) => {
					insert(elm);
				});
			}
		}

		async _createContent(info, successCallback, errorCallback)
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

			let el_content = await U.bindWrap(this._loadContent, this, info).catch(errorCallback);
			if (U.isUdf(el_content)) return;

			el_contentBlock.addEventListener("click", () => {
				let url = CONTENT_LINK + "?" + info.id;
				window.open(url, "_blank");
			});

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
				el_content.addEventListener("click", stopBubble);
				el_content.addEventListener("mouseenter", removeHover);
				el_content.addEventListener("mouseleave", addHover);
			}

			el_infoBlock.addEventListener("click", stopBubble);

			el_content.classList.add("content__source");
			el_sourceBlock.appendChild(el_content);

			successCallback(el_contentBlock);
		}

		async _loadContent(info, successCallback, errorCallback)
		{
			let content;
			let source = info.path ? info.path : info.srcUrl;
			let eventName;
			if (info.category === "image")
			{
				content = ContentCreator.createImage(source);
				content.classList.add("content__image");
				eventName = "load";
			}
			else if (info.category === "video")
			{
				content = ContentCreator.createVideo(source);
				content.classList.add("content__video");
				eventName = "loadeddata";
			}
			else if (info.category === "youtube")
			{
				content = ContentCreator.createIframe(source);
				content.classList.add("content__youtube");
				successCallback(content);
				return;
			}
			else if (info.category === "bookmark")
			{
				content = ContentCreator.createBookmark(source, info.docUrl);
				successCallback(content);
				return;
			}
			else
			{
				console.warn("invalid category:", info.category);
				errorCallback(null);
				return;
			}

			content.addEventListener(eventName, () => {
				successCallback(content);
			}, {once: true});
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

(function(){
	const DEFAULT_QUERY = "sort=!date",
		  SEARCH_BY_TAG = true,
		  cl_hide = "noshow",
		  cl_searchBoxFocused = "focus";

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

	const el_feed = document.getElementById("feed");

	const g_taggle = MyTaggle.createTaggle(el_tagContainer, {placeholder: "enter tags..."}),
		  g_searchBoxToggle = new Toggle();

	let g_feedBox;

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

	return function() {
		U.injectThemeCss(document.head, ["scrollbar", "alerts", "taggle", "gallery", "feed"], "light");

		listenReloadRequest();
		attachSubmit();
		g_searchBoxToggle.onToggleOn(switchToTags);
		g_searchBoxToggle.onToggleOff(switchToTitle);
		el_searchByBtn.addEventListener("click", () => {
			g_searchBoxToggle.toggle();
		});

		load();
	};

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

	// empty
	function listenReloadRequest()
	{
		// stuff
	}

	async function loadContent(query)
	{
		let meta = await U.wrap(requestMeta).catch(U.noop);
		if (U.isUdf(meta)) return;

		meta = Searcher.query(meta, query);
		g_feedBox = new FeedBox(meta, el_feed);
		g_feedBox.buffer();

		let tags = await U.wrap(ApiUtility.makeRequest, {request: "get-tags"}).catch(U.noop);
		MyTaggle.createAutoComplete(g_taggle, el_searchBox, tags);
	}

	async function requestMeta(successCallback, errorCallback)
	{
		let response = await U.wrap(ApiUtility.makeRequest, {request: "get-meta"}).catch(errorCallback);
		if (U.isUdf(response)) return;

		if (response.local && response.app)
		{
			let m = response.local.meta.concat(response.app.meta);
			successCallback(m);
		}
		else if (response.local)
		{
			successCallback(response.local.meta);
		}
		else if (response.app)
		{
			successCallback(response.app.meta);
		}
		else
		{
			console.warn("Could not handle response:", response);
			errorCallback(null);
		}
	}

	function makeQueryString()
	{
		let getSelected = (elm) => elm.options[elm.selectedIndex].value;
		let q = "";

		let title = el_titleInput.value;
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
})()();
