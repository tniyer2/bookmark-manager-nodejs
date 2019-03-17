
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

		if ("local" in response || "app" in response)
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
		getMeta(glb_searchField.value)
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
		createContent(meta);
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
	title.classList.add("contentTitle");
	let nameText = document.createTextNode(meta.title);
	title.appendChild(nameText);

	let content;
	if (meta.category === "image")
	{
		content = document.createElement("a");
		content.href = CONTENT_LINK + "?" + meta.id;

		let image = document.createElement("img");
		image.classList.add("contentImage");
		image.src = meta.path ? meta.path : meta.srcUrl;

		content.appendChild(image);
		innerBlock.appendChild(content);
	}
	else if (meta.category === "video")
	{
		if (meta.path)
		{
			content = document.createElement("video");
			innerBlock.appendChild(content);

			content.controls = true;
			content.style.width = "100%";
			content.style.height = "100%";

			source = document.createElement("source");
			source.src = meta.path;
			content.appendChild(source);
		}
		else
		{
			content = document.createElement("iframe");
			content.src = meta.srcUrl;
			innerBlock.appendChild(content);
		}
	}

	contentBlock.appendChild(innerBlock);
	contentBlock.appendChild(title);

	glb_feed.appendChild(contentBlock);
}
