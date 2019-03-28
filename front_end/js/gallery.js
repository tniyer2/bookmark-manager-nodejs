
(function(){

	const CONTENT_LINK  = "singleView.html";

	let el_feed = document.getElementById("feed");
	let el_searchBox = document.getElementById("search");

	getMeta();
	function getMeta(q)
	{
		chrome.runtime.sendMessage({request: "get-meta", query: q}, (response) => {

			if (chrome.runtime.lastError)
			{
				console.warn(chrome.runtime.lastError.message);
				return;
			}

			if (response.local || response.app)
			{
				if (response.local)
				{
					populateFeed(response.local.meta);
				}

				if (response.app)
				{
					populateFeed(response.app.meta);
				}
			}
			else
			{
				console.warn("Could not handle response:", response);
			}
		});
	}

	el_searchBox.addEventListener("keypress", (e) => {
		if (!e) e = window.event;
		let keyCode = e.keyCode || e.which;
		if (keyCode == '13')
		{
			clearFeed();
			getMeta(el_searchBox.value);
		}
	});

	function populateFeed(metaList)
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