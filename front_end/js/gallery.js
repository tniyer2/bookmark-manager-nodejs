
(function(){

	injectThemeCss("light", ["gallery", "taggle", "scrollbar", "alerts"]);

	const INPUT_WIDTH = 300;
	const TAGGLE_RESIZEABLE = false;

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

	const g_taggle = createTaggle(el_tagContainer, {placeholder: "enter tags..."});
	if (TAGGLE_RESIZEABLE)
	{
		el_tagContainer.style.width = "auto";
		el_tagContainer.style.minWidth = INPUT_WIDTH + "px";
	}
	
	let g_searchByTag = false;
	let g_submitted = false;

	attachSubmit();
	attachEvents();
	load();

	async function load()
	{
		let hrefQuery = decodeURI(location.search).substring(1);
		let q;
		if (hrefQuery)
		{
			q = Searcher.parse(hrefQuery);
		}
		else
		{
			q = DEFAULT_QUERY;
		}

		let meta = await wrap(requestMeta).catch(noop);
		if (isUdf(meta)) return;

		meta = Searcher.query(meta, q);
		populate(meta);

		let tags = await wrap(makeRequest, "get-tags").catch(noop);
		createAutoComplete(g_taggle, el_searchBox, tags);
	}

	function onSubmit()
	{
		function getSelected(elm)
		{
			return elm.options[elm.selectedIndex].value;
		}

		if (g_submitted)
		{
			return;
		}
		else
		{
			g_submitted = true;
		}

		let q = "";

		let sortby = getSelected(el_sortBy);
		if (sortby)
		{
			q += "&" + sortby + "=date";
		}

		if (el_titleInput.value)
		{
			q += "&title=" + el_titleInput.value;
		}

		let tags = g_taggle.getTags().values;
		let l = tags.length;
		if (l > 0)
		{
			q += "&tags=" + tags[0];
			for (let i = 1; i < l; i+=1)
			{
				q += "+" + tags[i];
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

		let loc = location.href;
		let i = loc.indexOf("?");
		let newLoc = loc.substring(0, i) + "?" + q;
		location.href = encodeURI(newLoc);
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
		el_submit.addEventListener("click", onSubmit, {once: true});

		onEnter(el_titleInput, onSubmit, () => el_titleInput.value);

		let taggleInput = g_taggle.getInput();
		onEnter(taggleInput, onSubmit, () => !taggleInput.value);
	}

	function attachEvents()
	{
		el_searchByBtn.addEventListener("click", () => {
			let useTags = el_searchBy.querySelectorAll("use");
			let a1, a2, r1, r2;
			if (g_searchByTag)
			{
				a1 = el_tagContainer;
				a2 = useTags[1];
				r1 = el_titleInput;
				r2 = useTags[0];

				g_taggle.removeAll();
			}
			else
			{
				a1 = el_titleInput;
				a2 = useTags[0];
				r1 = el_tagContainer;
				r2 = useTags[1];

				el_titleInput.value = "";
			}

			addClass(a1, cl_hide);
			addClass(a2, cl_hide);
			removeClass(r1, cl_hide);
			removeClass(r2, cl_hide);

			g_searchByTag = !g_searchByTag;
		});
	}
}).call(this);
