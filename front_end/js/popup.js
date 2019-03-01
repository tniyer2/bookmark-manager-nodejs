
const YOUTUBE_EMBED_URL = "http://www.youtube.com/embed/";
const YOUTUBE_REGEX = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/i;

let glb_category;
let glb_srcUrl;
let glb_docUrl;
let glb_tabId;

let glb_mask	 = document.getElementById("mask");
let glb_title 	 = document.getElementById("title");
let glb_save1    = document.getElementById("save1");
let glb_save2    = document.getElementById("save2");

chrome.runtime.sendMessage({request: "get-popupInfo"}, (response) => {

	if (chrome.runtime.lastError)
	{
		console.warn(chrome.runtime.lastError.message);
		return;
	}

	let srcUrl = response.srcUrl;

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
	else
	{
		if (response.scanInfo.linkUrls.length > 0)
		{
			console.log("Source was found in a link in the document.");
			glb_srcUrl = response.scanInfo.linkUrls[0].url;
			glb_title.value = response.scanInfo.linkUrls[0].title;
			glb_category = "video";
		}
		else if (response.scanInfo.videoUrls.length > 0)
		{
			console.log("Source was found in a video element.");
			glb_srcUrl = response.scanInfo.videoUrls[0].url;
			glb_title.value = response.scanInfo.videoUrls[0].title;
			glb_category = "video";
		}
		else
		{
			console.warn("No source was found.");
		}
	}
});

$(function(){
	$("#tags").tagit();
});

glb_mask.onclick = () => {
	chrome.tabs.sendMessage(glb_tabId, {to: "content.js", close: true});
};

// Save Link
glb_save1.onclick = () => {
	saveMeta(false);
	glb_save1.onclick = null;
};

// Save File on Server
glb_save2.onclick = () => {
	saveMeta(true);
	glb_save2.onclick = null;
};

async function saveMeta(download)
{
	let command = {
		download: download
	};

	let meta = {
		title: glb_title.value,
		tags: $("#tags").tagit("assignedTags"),
		category: glb_category,
		date: getDate(),
		srcUrl: glb_srcUrl,
		docUrl: glb_docUrl
	};

	let msg = { from: "popup.js",
				request: "upload-meta",
				command: command, 
				meta: meta };

	chrome.runtime.sendMessage(msg, (response) => {

		if (chrome.runtime.lastError)
		{
			console.warn(chrome.runtime.lastError.message);
			return;
		}

		if (response.success)
		{
			closePopup();
		}
		else if (response.outOfMemory)
		{
			console.warn("Not Implemented: outOfMemory");
		}
		else if (response.xhrError)
		{
			console.warn("Not Implemented: xhrError");
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

// Returns minutes since 1970.
function getDate()
{
	let today = new Date();
	let minutes = Math.floor(today.getTime() / (1000 * 60));
	return minutes;
}
