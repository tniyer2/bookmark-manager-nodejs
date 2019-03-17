
const DELETE_REDIRECT = chrome.runtime.getURL("html/gallery.html");

const glb_deleteButton = document.getElementById("remove");
const glb_query = getQueryFromHref();

let message = {request: "pick-meta", id: glb_query};
chrome.runtime.sendMessage(message, (response) => {

	if (chrome.runtime.lastError)
	{
		console.warn(chrome.runtime.lastError.message);
		return;
	}

	if (response.content)
	{
		createContent(response.content);
		glb_deleteButton.disabled = false;
	}
	else
	{
		console.warn("Could not handle response:", response);
	}
});

glb_deleteButton.disabled = true;
glb_deleteButton.onclick = () => {
	chrome.runtime.sendMessage({request: "delete-meta", id: glb_query}, (response) => {

		if (chrome.runtime.lastError)
		{
			console.warn(chrome.runtime.lastError.message);
			return;
		}

		if (response.success)
		{
			window.location = DELETE_REDIRECT;
		}
		else
		{
			console.warn("Could not handle response:", response);
		}
	});
};

function getQueryFromHref()
{
	let decoded = decodeURI(location.search);
	let index 	= decoded.indexOf("?");

	let query;
	if (index == decoded.length - 1)
	{
		query = "";
	}
	else
	{
		query = decoded.substring(index + 1);
	}

	return query;
}

function createContent(meta)
{
	let image = document.getElementById("image");
	image.src = meta.path ? meta.path : meta.srcUrl;

	let title = document.getElementById("title");
	let titleTextNode = document.createTextNode(meta.title);
	title.appendChild(titleTextNode);

	let tags = document.getElementById("tags");
	let tagsTextNode = document.createTextNode(meta.tags);
	tags.appendChild(tagsTextNode);
}
