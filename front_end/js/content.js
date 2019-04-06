
let el_iframe = document.createElement("iframe");
el_iframe.style = `position: fixed;
				   top: 0px;
				   left: 0px;
				   z-index: 1000;

				   display: none;
				   width: 100%;
				   height: 100%;
				  
				   outline: none;
				   background: none;
				   border: none;`;
document.body.insertBefore(el_iframe, document.body.firstChild);

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

	if (msg.to !== "content.js")
		return;

	if (msg.check)
	{
		sendResponse(true);
	}
	else if (msg.open)
	{
		openPopup();
	}
	else if(msg.close)
	{
		closePopup();
	}
});

function openPopup()
{
	el_iframe.src = chrome.runtime.getURL("html/popup.html");
	el_iframe.addEventListener("load", () => {
		el_iframe.style.display = "block";
	});
}
function closePopup()
{
	el_iframe.style.display = "none";
}
