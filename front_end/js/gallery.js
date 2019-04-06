
(function(){

	const CONTENT_LINK  = "singleView.html";
	const DEFAULT_QUERY = "dsc=date";

	let el_feed = document.getElementById("feed");
	let el_searchBox = document.getElementById("search");

	getMeta(DEFAULT_QUERY);
	function getMeta(q)
	{
		chrome.runtime.sendMessage({request: "get-meta"}, (response) => {

			if (chrome.runtime.lastError)
			{
				console.warn(chrome.runtime.lastError.message);
				return;
			}

			if (response.local && response.app)
			{
				let m = response.local.meta;
				m = m.concat(response.app.meta);
				_populate(m);
			}
			else if (response.local)
			{
				_populate(response.local.meta);
			}
			else if (response.app)
			{
				_populate(response.app.meta);
			}
			else
			{
				console.warn("Could not handle response:", response);
			}

			function _populate(meta)
			{
				meta = Searcher.query(meta, q);
				populate(meta);
			}
		});
	}

	el_searchBox.addEventListener("keydown", (evt) => {
		if (evt.key === "Enter" && el_searchBox.value)
		{
			clearFeed();
			getMeta(el_searchBox.value);
		}
	});

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

	function clearFeed()
	{
		while (el_feed.firstChild)
		{
			el_feed.removeChild(el_feed.firstChild);
		}
	}
}).call(this);
