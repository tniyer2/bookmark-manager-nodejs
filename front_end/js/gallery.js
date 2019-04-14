
(function(){

	const CONTENT_LINK  = "singleView.html";
	const DEFAULT_QUERY = {dsc: "date"};

	let el_feed = document.getElementById("feed");
	let el_searchBox = document.getElementById("search-box");
	let el_input = el_searchBox.querySelector("input");

	load();
	attachEvents();

	async function load()
	{
		let hrefQuery = location.search.substring(1);
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
	}

	function requestMeta(successCallback, errorCallback)
	{
		chrome.runtime.sendMessage({request: "get-meta"}, (response) => {

			if (chrome.runtime.lastError)
			{
				console.warn(chrome.runtime.lastError.message);
				errorCallback(null);
				return;
			}

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

	function attachEvents()
	{
		el_input.addEventListener("keydown", (evt) => {
			if (evt.key === "Enter" && el_input.value)
			{
				let s = location.href;
				let i = s.indexOf("?") + 1;
				location = s.substring(0, i) + el_input.value;
			}
		});
	}
}).call(this);
