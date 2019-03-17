
const YOUTUBE_EMBED_URL = "http://www.youtube.com/embed/";
const YOUTUBE_REGEX = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/i;

let glb_category;
let glb_srcUrl;
let glb_docUrl;
let glb_connected;
let glb_tabId;

let glb_mask  	 = document.getElementById("mask");
let glb_title 	 = document.getElementById("title");
let glb_save 	 = document.getElementById("save");
let glb_download = document.getElementById("download");

let myTaggle = new Taggle("tags", {});

chrome.runtime.sendMessage({request: "get-popupInfo"}, (response) => {

	if (chrome.runtime.lastError)
	{
		console.warn(chrome.runtime.lastError.message);
		return;
	}

	let srcUrl   = response.srcUrl;
	let scanInfo = response.scanInfo; 

	glb_tabId     = response.tabId;
	glb_connected = response.connected;
	glb_docUrl    = response.docUrl;

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

glb_mask.onclick = () => {
	closePopup();
};

// save
glb_save.onclick = () => {
	glb_save.onclick = null;
	saveMeta();
};

// download
glb_download.onclick = () => {
	downloadSrc();
};

async function saveMeta()
{
	let meta = {
		title: glb_title.value,
		tags: myTaggle.getTags().values,
		category: glb_category,
		date: getMinutes(),
		srcUrl: glb_srcUrl,
		docUrl: glb_docUrl
	};

	let msg = {request: "add-meta", meta: meta};

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
		else
		{
			console.warn("Could not handle response:", response);
		}
	});
}

async function downloadSrc()
{
	console.warn("downloadSrc() is not implemented");
}

function closePopup()
{
	chrome.tabs.sendMessage(glb_tabId, {to: "content.js", close: true});
}

// Returns the minutes passed since the Unix Epoch.
function getMinutes()
{
	let milli = new Date().getTime();
	let minutes = Math.floor(milli / (1000 * 60));
	return minutes;
}
