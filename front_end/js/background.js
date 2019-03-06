
const DESKTOP_APPLICATION_NAME = "tagger_plus_desktop";

let glb_useLocal = false;

let glb_port = chrome.runtime.connectNative(DESKTOP_APPLICATION_NAME);
glb_port.onDisconnect.addListener(() => {
	if (chrome.runtime.lastError)
	{
		console.warn(chrome.runtime.lastError.message);
		return;
	}
});

// Listens to messages.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

	if (chrome.runtime.lastError)
	{
		console.warn(chrome.runtime.lastError.message);
		return;
	}

	if (msg.request === "get-popupInfo")
	{
		let response = {};

		response.srcUrl = glb_popupInfo.srcUrl;
		response.docUrl = sender.tab.url === glb_popupInfo.srcUrl ? "src" : sender.tab.url ;

		response.scanInfo  = glb_popupInfo.scanInfo;
		response.mediaType = glb_popupInfo.mediaType;
		response.tabId	   = sender.tab.id;

		sendResponse(response);
	}
	else if (msg.request === "get-meta")
	{
		let sendMeta = (meta) => {
			meta = query(meta, msg.query);
			let response = {meta: meta};
			sendResponse(response);
		};

		if (glb_useLocal)
		{
			getMetaLocally("all", (meta) => {
				sendMeta(meta);
			});
		}
		else
		{
			let tag = String(sender.tab.id);
			glb_port.postMessage({tag: tag, type: "get"});
			glb_port.onMessage.addListener((response) => {
				if (response.tag === tag)
					sendMeta(response.result);
			});
		}

		return true;
	}
	else if (msg.request === "upload-meta")
	{
		if (glb_useLocal)
		{
			uploadMetaLocally(msg.meta, (response) => {
				if (response.success)
				{
					sendResponse({success: true});
				}
				else if (response.outOfMemory)
				{
					sendResponse({outOfMemory: true});
				}
				else if (response.lastError)
				{
					console.warn(response.lastError);
				}
				else
				{
					console.warn("Unkown response from uploadMetaLocally callback:");
					console.warn(response);
				}
			});
		}
		else
		{
			let tag = sender.tab.id;
			glb_port.postMessage({tag: tag, type: "add", content: msg.meta});
			sendResponse({success: true});
		}

		return true;
	}
	else if (msg.request === "delete-meta")
	{
		if (glb_useLocal)
		{
			deleteMetaLocally(msg.id, (response) => {
				if (response.success)
				{
					sendResponse({success: true});
				}
				else if (response.outOfMemory)
				{
					sendResponse({outOfMemory: true});
				}
				else if (response.lastError)
				{
					console.warn(response.lastError);
				}
				else
				{
					console.warn("Couldn't handle response of deleteMetaLocally callback:");
					console.warn(response);
				}
			});
		}
		else
		{

		}

		return true;
	}
	else
	{
		console.warn("Content script sent unknown message:");
		console.warn(msg);
	}
});

// browser action opens up the gallery.
chrome.browserAction.onClicked.addListener((tab) => {
	chrome.tabs.create({url: "html/gallery.html"});
});

// Creates context menu item "Save".
chrome.contextMenus.removeAll(() => {
	let saveInfo = {
		title: "Save",
		id:"Save",
		contexts:["all"],
		documentUrlPatterns: ["http://*/*", "https://*/*", "data:image/*", "file://*"]
	};

	chrome.contextMenus.create(saveInfo);
});

// Activates popup when context menu item "Save" is clicked.
chrome.contextMenus.onClicked.addListener((info, tab) => {

	glb_popupInfo = { srcUrl: info.srcUrl,
					  mediaType: info.mediaType };

	chrome.tabs.sendMessage(tab.id, {to: "boot.js", script: "js/boot.js", getClickedElementInfo: true}, (html) => {
		if (chrome.runtime.lastError) {console.warn(chrome.runtime.lastError.message); return;}
		sendMessageToScript(tab.id, {to: "scanner.js", script: "js/scanner.js", scan: true, html: html}, (scanInfo) => {
			if (chrome.runtime.lastError) {console.warn(chrome.runtime.lastError.message); return;}
			glb_popupInfo.scanInfo = scanInfo;
			sendMessageToScript(tab.id, {to: "content.js", script: "js/content.js", open: true});
		});
	});
});

function sendMessageToScript(tabId, msg, callback)
{
	chrome.tabs.sendMessage(tabId, {to: msg.to, check: true}, (exists) => {
		if (chrome.runtime.lastError) { /*ignore*/ }

		if (exists)
		{
			chrome.tabs.sendMessage(tabId, msg, callback);
		}
		else
		{
			chrome.tabs.executeScript(tabId, {file: msg.script}, (result) => {
				chrome.tabs.sendMessage(tabId, msg, callback);
			});
		}
	});
}
