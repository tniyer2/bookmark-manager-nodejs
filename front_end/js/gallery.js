
(function(){

	injectThemeCss("light", ["gallery", "taggle", "scrollbar", "alerts"]);

	const CONTENT_LINK  = "singleView.html";
	const DEFAULT_QUERY = {dsc: "date"};
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
	
	let g_titleWidget, g_tagWidget;
	let g_searchByTag = false;
	let g_submitted = false;

	attachSubmit();
	el_searchByBtn.addEventListener("click", switchSearch);
	attachStyleEvents();
	load();

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
			map = DEFAULT_QUERY;
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

		let sortby = getSelected(el_sortBy);
		if (sortby)
		{
			q += "&" + sortby + "=date";
		}

		let title = el_titleInput.value;
		if (title)
		{
			q += "&title=" + encodeURIComponent(title);
		}

		let tags = g_taggle.getTags().values;
		if (tags.length > 0)
		{
			q += "&tags=";
			for (let i = 0, l = tags.length; i < l; i+=1)
			{
				q += "+" + encodeURIComponent(tags[i]);
			}
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

		let indices = cookie.split("-");
		el_date.selectedIndex = indices[0];
		el_category.selectedIndex = indices[1];
		el_sortBy.selectedIndex = indices[2];
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
		populate(meta);

		let tags = await wrap(makeRequest, "get-tags").catch(noop);
		MyTaggle.createAutoComplete(g_taggle, el_searchBox, tags);
	}

	async function requestMeta(successCallback, errorCallback)
	{
		let response = await wrap(makeRequest, "get-meta").catch(errorCallback);

		if (isUdf(response)) {/*ignore*/}
		else if (response.local && response.app)
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

	function makeRequest(request, successCallback, errorCallback)
	{
		chrome.runtime.sendMessage({request: request}, (response) => {

			if (chrome.runtime.lastError)
			{
				console.warn(chrome.runtime.lastError.message);
				errorCallback(null);
			}
			else if (typeof response === "object" && response.error)
			{
				console.log("error in request:", response.error);
				errorCallback(null);
			}
			else
			{
				successCallback(response);
			}
		});
	}

	function populate(metaList)
	{
		if (!metaList)
		{
			console.warn("metaList is", metaList);
			return;
		}

		for (let i = 0, l = metaList.length; i < l; i+=1)
		{
			let meta = metaList[i];

			let content = createContent(meta);
			content.addEventListener("click", () => {
				document.location.href = CONTENT_LINK + "?" + meta.id;
			});

			el_feed.appendChild(content);
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
