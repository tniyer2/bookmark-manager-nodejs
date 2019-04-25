
const FeedBox = (function(){

	const CONTENT_LINK  = "singleView.html";
	const DEFAULT_TITLE = "untitled";
	const DEFAULTS = { bufferSize: 20,
					   bufferOnScrollBottom: true,
					   scrollBottomOffset: 500,
					   scrollBottomBufferDelay: 0 };
	return class {
		constructor(meta, el_parent, options)
		{
			this._meta = meta;
			this._queue = new Widgets.DOMQueue(el_parent);
			this._el_test = document.createElement("canvas");

			this._options = extend(DEFAULTS, options);

			this._onScrollBound = this._onScroll.bind(this);
			if (this._options.bufferOnScrollBottom === true)
			{
				this._attachBufferOnScroll();
			}
		}

		buffer()
		{
			let l1 = this._meta.length;
			let initial = this._queue.count;
			let l2 = initial + this._options.bufferSize;
			while (this._queue.count < l1 && this._queue.count < l2)
			{
				let content = this._meta[this._queue.count];
				let insert = this._queue.next();

				this._createContent(content, (el_contentBlock) => {
					insert(el_contentBlock);
				});
			}

			return this._numLoaded - initial;
		}

		_createContent(content, successCallback, errorCallback)
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

			let titleText = content.title ? content.title : DEFAULT_TITLE;
			let titleTextNode = document.createTextNode(titleText);
			el_title.appendChild(titleTextNode);
			el_infoBlock.appendChild(el_title);

			let el_content;
			function successCallbackWrapper()
			{
				el_content.classList.add("content__source");
				el_infoBlock.addEventListener("click", (evt) => {
					evt.stopPropagation();
				});
				el_contentBlock.addEventListener("click", () => {
					let url = CONTENT_LINK + "?" + content.id;
					window.open(url, "_blank");
				});
				el_sourceBlock.appendChild(el_content);

				successCallback(el_contentBlock);
			}

			let source = content.path ? content.path : content.srcUrl;
			let eventName;
			if (content.category === "image")
			{
				el_content = ContentCreator.createImage(source);
				el_content.classList.add("content__image");
				eventName = "load";
			}
			else if (content.category === "video")
			{
				el_content = ContentCreator.createVideo(source);
				el_content.classList.add("content__video");
				eventName = "loadeddata";
			}
			else if (content.category === "youtube")
			{
				el_content = ContentCreator.createIframe(source);
				el_content.classList.add("content__youtube");
				successCallbackWrapper();
				return;
			}
			else if (content.category === "bookmark")
			{
				el_content = ContentCreator.createBookmark(source);
				el_content.addEventListener("click", (evt) => {
					evt.stopPropagation();
				});
				successCallbackWrapper();
				return;
			}
			else
			{
				console.warn("invalid category:", content.category);
				return;
			}

			el_content.addEventListener(eventName, successCallbackWrapper, {once: true});
		}

		_attachBufferOnScroll()
		{
			window.addEventListener("scroll", this._onScrollBound);
		}

		_onScroll()
		{
			if (( window.innerHeight
				+ Math.ceil(window.pageYOffset + 1)
				+ this._options.scrollBottomOffset ) >= document.body.offsetHeight)
			{
				window.removeEventListener("scroll", this._onScrollBound);
				setTimeout(() => {
					this.buffer();
					this._attachBufferOnScroll();
				}, this._options.scrollBottomBufferDelay * 1000);
			}
		}
	};
})();

(function(){

	injectThemeCss("light", ["scrollbar", "alerts", "taggle", "gallery", "feed"]);

	const DEFAULT_QUERY = "sort=!date";
	const cl_hide = "noshow";

	const el_form = document.getElementById("search");
	const el_searchBox = el_form.querySelector("#search-box");
	const el_titleInput = el_form.querySelector("#title-input");
	const el_tagContainer = el_form.querySelector("#tag-container");
	const el_searchBy = el_form.querySelector("#searchby");
	const el_searchByBtn = el_form.querySelector("#searchby-btn");
	const el_date = el_form.querySelector("#date");
	const el_category = el_form.querySelector("#category");
	const el_sortBy = el_form.querySelector("#sortby");
	const el_submit = el_form.querySelector("#submit");

	const el_feed = document.getElementById("feed");

	const g_taggle = MyTaggle.createTaggle(el_tagContainer, {placeholder: "enter tags..."});

	let g_titleWidget, g_tagWidget, g_feedBox;
	let g_searchByTag;
	let g_submitted = false;

	hideInput(true);
	attachSubmit();
	el_searchByBtn.addEventListener("click", switchSearch);
	attachStyleEvents();
	load();

	function hideInput(hideTitle)
	{
		g_searchByTag = hideTitle;
		let i = hideTitle ? el_titleInput : el_tagContainer;
		let arr = el_searchBy.querySelectorAll("use");
		let u = hideTitle ? arr[0] : arr[1];
		i.classList.add(cl_hide);
		u.classList.add(cl_hide);
	}

	function load()
	{
		let hrefQuery = location.search.substring(1);
		let i = hrefQuery.lastIndexOf("&");
		let len = hrefQuery.length;
		let query = hrefQuery.substring(0, i);
		let cookie  = hrefQuery.substring(i + 1, len);

		let map;
		if (query)
		{
			map = Searcher.parse(query);
		}
		else
		{
			map = Searcher.parse(DEFAULT_QUERY);
		}

		useCookie(map, cookie);
		loadContent(map);
	}

	function submitSearch()
	{
		if (g_submitted) {
			return;
		} else {
			g_submitted = true;
		}

		let queryString = makeQueryString();
		let cookie = makeCookie();

		let i = location.href.indexOf("?");
		let loc = location.href.substring(0, i);
		let redirect = loc + "?" + queryString + "&" + cookie;
		location.href = redirect;
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

		let offset = getSelected(el_date);
		if (offset)
		{
			let ms = Number(offset) * 24 * 60 * 60 * 1000;
			let date = Date.now() - ms;
			q += "&date=x>" + date;
		}

		return q;
	}

	function useCookie(map, cookie)
	{
		if (map.title)
		{
			el_titleInput.value = map.title;
			if (g_searchByTag) switchSearch();
		}
		else if (map.tags)
		{
			for (let tag of map.tags)
			{
				g_taggle.add(tag);
			}
			if (!g_searchByTag) switchSearch();
		}
		else
		{
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

	function makeCookie()
	{
		let cookie = `${el_date.selectedIndex}-${el_category.selectedIndex}-${el_sortBy.selectedIndex}`;
		return cookie;
	}

	async function loadContent(q)
	{
		let meta = await wrap(requestMeta).catch(noop);
		if (isUdf(meta)) return;

		meta = Searcher.query(meta, q);
		g_feedBox = new FeedBox(meta, el_feed);
		g_feedBox.buffer();

		let tags = await wrap(makeRequest, {request: "get-tags"}).catch(noop);
		MyTaggle.createAutoComplete(g_taggle, el_searchBox, tags);
	}

	async function requestMeta(successCallback, errorCallback)
	{
		let response = await wrap(makeRequest, {request: "get-meta"}).catch(errorCallback);
		if (isUdf(response)) return;

		if (response.local && response.app)
		{
			let m = response.local.meta;
			m = m.concat(response.app.meta);
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

	function attachSubmit()
	{
		let onEnter = (elm, callback, condition) => {
			elm.addEventListener("keydown", (evt) => {
				if (evt.key === "Enter" && condition())
				{
					callback();
				}
			});
		};

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

	function attachStyleEvents()
	{
		g_titleWidget = Widgets.styleOnFocus(el_searchBox, "focus",
							{ focusTarget: el_titleInput,
							  mouseTarget: el_searchBox,
							  disable: g_searchByTag });
		g_tagWidget = Widgets.styleOnFocus(el_searchBox, "focus",
							{ focusTarget: el_tagContainer,
			  				  mouseTarget: el_searchBox,
							  disable: !g_searchByTag });
	}

	function switchSearch()
	{
		let useTags = el_searchBy.querySelectorAll("use");
		let a1, a2, r1, r2, w1, w2;
		if (g_searchByTag)
		{
			a1 = el_tagContainer;
			a2 = useTags[1];
			r1 = el_titleInput;
			r2 = useTags[0];
			w1 = g_tagWidget;
			w2 = g_titleWidget;

			g_taggle.removeAll();
		}
		else
		{
			a1 = el_titleInput;
			a2 = useTags[0];
			r1 = el_tagContainer;
			r2 = useTags[1];
			w1 = g_titleWidget;
			w2 = g_tagWidget;

			el_titleInput.value = "";
		}

		addClass(a1, cl_hide);
		addClass(a2, cl_hide);
		removeClass(r1, cl_hide);
		removeClass(r2, cl_hide);
		w1.disable();
		w2.enable();

		g_searchByTag = !g_searchByTag;
	}
}).call(this);
