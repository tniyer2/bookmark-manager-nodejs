
const DELETE_REDIRECT = chrome.runtime.getURL("html/gallery.html");
const ID = getIdFromHref();

const el_main = document.getElementById("main");
const el_deleteBtn = el_main.querySelector("#delete-btn");

chrome.runtime.sendMessage({request: "pick-meta", id: ID}, (response) => {

	if (chrome.runtime.lastError)
	{
		console.warn(chrome.runtime.lastError.message);
		return;
	}

	if (response.content)
	{
		let content = createContent(response.content);
		el_main.insertBefore(content, el_deleteBtn);
		el_deleteBtn.disabled = false;
	}
	else
	{
		console.warn("Could not handle response:", response);
	}
});

el_deleteBtn.addEventListener("click", () => {
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
