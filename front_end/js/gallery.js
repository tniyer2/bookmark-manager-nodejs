
const CONTENT_LINK  = "singleView.html";

let glb_feed = document.getElementById("feed");
let glb_searchField = document.getElementById("search");

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

glb_searchField.onkeypress = (e) => {
	if (!e) e = window.event;
	let keyCode = e.keyCode || e.which;
	if (keyCode == '13')
	{
		clearFeed();
		getMeta(glb_searchField.value);
	}
};

function populateFeed(metaList)
{
	if (!metaList)
	{
		console.warn("metaList is " + metaList);
		return;
	}

	for (let meta of metaList)
	{
		let content = createContent(meta);
		glb_feed.appendChild(content);
	}
}

function clearFeed()
{
	while (glb_feed.firstChild)
	{
		glb_feed.removeChild(glb_feed.firstChild);
	}
}

function createContent(meta)
{
	let contentBlock = document.createElement("div");
	contentBlock.classList.add("contentBlock");

	let innerBlock = document.createElement("div");
	innerBlock.classList.add("imageBlock");

	let title = document.createElement("p");
	title.classList.add("title");
	let nameText = document.createTextNode(meta.title);
	title.appendChild(nameText);

	if (meta.category === "image")
	{
		let content = document.createElement("img");
		content.classList.add("image");
		content.src = meta.path ? meta.path : meta.srcUrl;

		innerBlock.appendChild(content);
	}
	else if (meta.category === "video")
	{
		let content = document.createElement("video");
		content.classList.add("video");
		content.controls = true;

		if (meta.path)
		{
			content.src = meta.path;
		}
		else
		{
			content.src = meta.srcUrl;
		}

		innerBlock.appendChild(content);
	}
	else if (meta.category === "web")
	{
		// not supported for now
	}
	else
	{
		console.log("invalid category:", meta.category)
		return;
	}

	contentBlock.appendChild(innerBlock);
	contentBlock.appendChild(title);
	contentBlock.addEventListener("click", () => {
		document.location.href = CONTENT_LINK + "?" + meta.id;
	});

	return contentBlock;
}
