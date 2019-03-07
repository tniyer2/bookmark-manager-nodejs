
const YOUTUBE_EMBED_URL = "http://www.youtube.com/embed/";
const YOUTUBE_REGEX = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/i;

let glb_category;
let glb_srcUrl;
let glb_docUrl;
let glb_tabId;

let glb_mask  = document.getElementById("mask");
let glb_title = document.getElementById("title");
let glb_save1 = document.getElementById("save1");
let glb_save2 = document.getElementById("save2");

chrome.runtime.sendMessage({request: "get-popupInfo"}, (response) => {

	if (chrome.runtime.lastError)
	{
		console.warn(chrome.runtime.lastError.message);
		return;
	}

	let srcUrl   = response.srcUrl;
	let scanInfo = response.scanInfo; 

	glb_tabId   = response.tabId;
	glb_docUrl  = response.docUrl;

	if (glb_docUrl.indexOf("www.youtube.com") > 0)
	{
		let matches = glb_docUrl.match(YOUTUBE_REGEX);

		glb_srcUrl = YOUTUBE_EMBED_URL + matches[1];
		glb_category = "video";
		glb_save2.style.display = "none";
	}
	else if (srcUrl)
	{
		glb_srcUrl = srcUrl;
		glb_category = response.mediaType;
	}
	else if (scanInfo.linkUrls.length > 0)
	{
		console.log("Source was found in a link in the document.");

		glb_srcUrl = scanInfo.linkUrls[0].url;
		glb_title.value = scanInfo.linkUrls[0].title;
		glb_category = "video";
	}
	else if (scanInfo.videoUrls.length > 0)
	{
		console.log("Source was found in a video element.");

		glb_srcUrl = scanInfo.videoUrls[0].url;
		glb_title.value = scanInfo.videoUrls[0].title;
		glb_category = "video";
	}
	else
	{
		console.warn("No source was found.");
	}
});

$(function(){
	$("#tags").tagit();
});

glb_mask.onclick = () => {
	closePopup();
};

// Bookmark source
glb_save1.onclick = () => {
	saveMeta(false);
	glb_save1.onclick = null;
};

// Bookmark and download source
glb_save2.onclick = () => {
	saveMeta(true);
	glb_save2.onclick = null;
};

async function saveMeta(download)
{
	let meta = {
		title: glb_title.value,
		tags: $("#tags").tagit("assignedTags"),
		category: glb_category,
		date: getMinutes(),
		srcUrl: glb_srcUrl,
		docUrl: glb_docUrl
	};

	let msg = { request: "add-meta",
				download: download,
				meta: meta };

	chrome.runtime.sendMessage(msg, (response) => {

		if (chrome.runtime.lastError)
		{
			console.warn(chrome.runtime.lastError.message);
			return;
		}

		if (response.success === true)
		{
			closePopup();
		}
		else if (response.outOfMemory === true)
		{
			console.warn("Not Implemented: outOfMemory");
		}
		else if (response.clientError === true)
		{
			console.warn("Not Implemented: clientError");
		}
		else
		{
			console.warn("Could not handle response:");
			console.warn(response);
		}
	});
}

function closePopup()
{
	chrome.tabs.sendMessage(glb_tabId, {to: "content.js", close: true});
}

// Returns minutes since the Unix Epoch.
function getMinutes()
{
	let today = new Date();
	let minutes = Math.floor(today.getTime() / (1000 * 60));
	return minutes;
}
