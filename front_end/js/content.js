
let el_root;
let el_iframe;

injectPopup();

function injectPopup()
{
	injectCss(document.head, "css/content.css");

	el_root = document.createElement("div");
	el_root.classList.add("root");
	el_root.style.display = "none";

	el_iframe = document.createElement("iframe");
	el_iframe.classList.add("frame");
		el_root.appendChild(el_iframe);

	document.body.insertBefore(el_root, document.body.firstChild);
}

function injectCss(parent, relativeUrl)
{
	let ss  = document.createElement("link");
	ss.rel  = "stylesheet";
	ss.type = "text/css";
	ss.href = chrome.runtime.getURL(relativeUrl);
	parent.appendChild(ss);
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

	if (msg.to !== "content.js")
		return;

	if (msg.check)
	{
		sendResponse(true);
		return;
	}

	if (msg.open)
	{
		openPopup();
	}
	else if (msg.close)
	{
		closePopup();
	}
});

function openPopup(argument) 
{
	el_iframe.src = chrome.runtime.getURL("html/popup.html");
	el_root.style.display = "block";
}
function closePopup()
{
	el_root.style.display = "none";
}
