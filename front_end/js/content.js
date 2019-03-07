
let glb_root;
let glb_frame;

initPopupDOM();

function initPopupDOM()
{
	let ss  = document.createElement("link");
	ss.rel  = "stylesheet";
	ss.type = "text/css";
	ss.href = chrome.runtime.getURL("css/content.css");
	document.head.appendChild(ss);

	glb_root = document.createElement("div");
	glb_root.classList.add("root");
	glb_root.style.display = "none";

	glb_frame = document.createElement("iframe");
	glb_frame.classList.add("frame");
		glb_root.appendChild(glb_frame);

	document.body.insertBefore(glb_root, document.body.firstChild);
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
		glb_frame.src = chrome.runtime.getURL("html/popup.html");
		glb_root.style.display = "block";
	}
	else if (msg.close)
	{
		closePopup();
	}
});

function closePopup()
{
	glb_root.style.display = "none";
}
