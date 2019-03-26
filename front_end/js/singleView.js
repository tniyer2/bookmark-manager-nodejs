
const DELETE_REDIRECT = chrome.runtime.getURL("html/gallery.html");
const ID = getIdFromHref();

const glb_main = document.getElementById("main");
const glb_deleteButton = document.getElementById("remove");

let message = {request: "pick-meta", id: ID};
chrome.runtime.sendMessage(message, (response) => {

	if (chrome.runtime.lastError)
	{
		console.warn(chrome.runtime.lastError.message);
		return;
	}

	if (response.content)
	{
		let content = createContent(response.content);
		glb_main.insertBefore(content, glb_deleteButton);
		glb_deleteButton.disabled = false;
	}
	else
	{
		console.warn("Could not handle response:", response);
	}
});

glb_deleteButton.addEventListener("click", () => {
	chrome.runtime.sendMessage({request: "delete-meta", id: ID}, (response) => {

		if (chrome.runtime.lastError)
		{
			console.warn(chrome.runtime.lastError.message);
			return;
		}

		if (response.success)
		{
			document.location.href = DELETE_REDIRECT;
		}
		else
		{
			console.warn("Could not handle response:", response);
		}
	});
});

function getIdFromHref()
{
	let decoded = decodeURI(location.search);
	let index 	= decoded.indexOf("?");

	let id;
	if (index == decoded.length - 1)
	{
		id = "";
	}
	else
	{
		id = decoded.substring(index + 1);
	}

	return id;
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
