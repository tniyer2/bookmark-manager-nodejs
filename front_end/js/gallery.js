
const CONTENT_LINK = "single_view.html";

let glb_feed = document.getElementById("feed");
let glb_searchField = document.getElementById("search");

chrome.runtime.sendMessage({request: "get-meta", query: "all"}, (response) => {

	if (chrome.runtime.lastError)
	{
		console.warn(chrome.runtime.lastError.message);
		return;
	}

	if (response.xhrError)
	{
		console.warn("Not Implemented: xhrError");
		return;
	}

	populateFeed(response.meta, response.path);
});

//e is a KeyboardEvent object
glb_searchField.onkeypress = function(e){
	if (!e) e = window.event;
	let keyCode = e.keyCode || e.which;
	if (keyCode == '13')
	{
		clearFeed();
		chrome.runtime.sendMessage({from: "gallery.js", request: "get-meta", query: glb_searchField.value});
	}
};

// meta - an array of metaObjects
// Loads all content from metaObjects in meta
// path - path of resource context
function populateFeed(meta, path)
{
	if (!meta)
	{
		console.warn("meta is " + meta);
		return;
	}

	for (let obj of meta)
	{
		createContent(obj, path);
	}
}

function clearFeed()
{
	while (glb_feed.firstChild)
	{
		glb_feed.removeChild(glb_feed.firstChild);
	}
}

// Creates one block of content
// metaObject - metadata on one block of content
// path - path of resource context
function createContent(metaObject, path)
{
	let contentBlock = document.createElement("div");
	contentBlock.classList.add("contentBlock");

	let innerBlock = document.createElement("div");
	innerBlock.classList.add("imageBlock");

	let title = document.createElement("p");
	title.classList.add("contentTitle");
	let nameText = document.createTextNode(metaObject.title);
	title.appendChild(nameText);

	let content;
	if (metaObject.category === "image")
	{
		content = document.createElement("a");
		content.href = CONTENT_LINK + "?" + metaObject.id;

		let image = document.createElement("img");
		image.classList.add("contentImage");
		if (metaObject.path)
		{
			image.src = path + metaObject.path;
		}
		else
		{
			image.src = metaObject.srcUrl;
		}

		content.appendChild(image);
		innerBlock.appendChild(content);
	}
	else if(metaObject.category === "video")
	{
		if(metaObject.path)
		{
			content = document.createElement("video");
			innerBlock.appendChild(content);

			content.controls = true;
			content.style.width = "100%";
			content.style.height = "100%";

			source = document.createElement("source");
			source.src = path + metaObject.path;
			content.appendChild(source);
		}
		else
		{
			content = document.createElement("iframe");
			content.src = metaObject.srcUrl;
			innerBlock.appendChild(content);
		}
	}

	contentBlock.appendChild(innerBlock);
	contentBlock.appendChild(title);

	glb_feed.appendChild(contentBlock);
}
