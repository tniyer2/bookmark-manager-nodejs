
let glb_deleteButton = document.getElementById("delete");
let glb_query = getQueryFromHref();

chrome.runtime.sendMessage({request: "get-meta", query: "id=" + glb_query}, (response) => {

	if (chrome.runtime.lastError)
	{
		console.warn(chrome.runtime.lastError.message);
		return;
	}

	if (response.meta.length == 0)
	{
		console.warn("Could not get content.");
		return;
	}
	else if (response.meta.length > 1)
	{
		console.warn("Query did not return an individual meta.");
		return;
	}

	if (response.xhrError)
	{
		console.warn("Not Implemented: xhrError");
		return;
	}

	createContent(response.meta[0], response.path);
	glb_deleteButton.disabled = false;
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
			// ignore
		}
		else if (response.xhrError)
		{
			console.warn("Not Implemented: xhrError");
		}
		else if (response.outOfMemory)
		{
			console.warn("Requesting delete should not return an outOfMemory error.");
		}
		else 
		{
			console.warn("Could not handle response:");
			console.warn(response);
		}
	});
};

function createContent(content, path)
{
	let image = document.getElementById("image");
	if (content.path)
	{
		image.src = path + content.path;
	}
	else
	{
		image.src = content.srcUrl;
	}

	let title = document.getElementById("title");
	let titleTextNode = document.createTextNode(content.title);
	title.appendChild(titleTextNode);

	let tags = document.getElementById("tags");
	let tagsTextNode = document.createTextNode(content.tags);
	tags.appendChild(tagsTextNode);
}

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
