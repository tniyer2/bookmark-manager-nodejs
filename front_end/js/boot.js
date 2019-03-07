
let glb_info;

document.addEventListener("contextmenu", (e) => {
	glb_info = {};
	glb_info.element = e.target.outerHTML;
	glb_info.parent  = e.target.parentElement.outerHTML;
});


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

	if (message.to !== "boot.js")
		return;

	if (message.getClickedElementInfo)
	{
		if (!glb_info)
		{
			console.warn("clickedInfo should not be " + glb_info);
			return;
		}
		sendResponse(glb_info);
	}
});
