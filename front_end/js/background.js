
const DESKTOP_APPLICATION_NAME = "tagger_plus_desktop";
const DEFAULT_QUERY = "all";

let glb_useLocal = true;
let glb_port;

if (!glb_useLocal)
{
	glb_port = chrome.runtime.connectNative(DESKTOP_APPLICATION_NAME);
	glb_port.onDisconnect.addListener(() => {
		if (chrome.runtime.lastError)
		{
			console.warn(chrome.runtime.lastError.message);
			return;
		}
	});
}

// Listens to messages.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

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
		let query = msg.query ? msg.query : DEFAULT_QUERY;

		if (glb_useLocal)
		{	(async () => {
				let meta = await wrap(getMetaLocally, query).catch(e => sendResponse(e));
				if (typeof meta === "undefined") return;
				sendResponse({meta: meta});
			})();
		}
		else
		{
			let tag = sender.tab.id + "get" + getSeconds();
			glb_port.postMessage({tag: tag, type: "get", query: query});
			glb_port.onMessage.addListener((response) => {
				if (response.tag === tag)
				{
					sendResponse({meta: response.result});
				}
			});
		}

		return true;
	}
	else if (msg.request === "add-meta")
	{
		if (glb_useLocal)
		{
			(async () => {
				let success = await wrap(addMetaLocally, msg.meta).catch(e => sendResponse(e));
				if (success !== true) return;
				sendResponse({success: true});
			})();
		}
		else
		{
			let tag = sender.tab.id + "add" + getSeconds();
			glb_port.postMessage({tag: tag, type: "add", content: msg.meta});
			glb_port.onMessage.addListener((response) => {
				if (response.tag === tag)
				{
					sendResponse({success: true});
				}
			});
		}

		return true;
	}
	else if (msg.request === "delete-meta")
	{
		if (glb_useLocal)
		{
			(async () => {
				let success = await wrap(deleteMetaLocally, msg.id).catch(e => sendResponse(e));
				if (success !== true) return;
				sendResponse({success: true});
			})();
		}
		else
		{
			let tag = sender.tab.id + "delete" + getSeconds();
			glb_port.postMessage({tag: tag, request: "delete", id: msg.id});
			glb_port.onMessage.addListener((response) => {
				if (response.tag === tag)
				{
					sendResponse({success: true});
				}
			});
		}
 
		return true;
	}
	else
	{
		console.warn("Content script sent unknown message:", msg);
	}
});

// Browser action opens up the gallery.
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

// Sends message to a script. Injects script if necessary.
function sendMessageToScript(tabId, msg, callback)
{
	chrome.tabs.sendMessage(tabId, {to: msg.to, check: true}, (exists) => {
		if (chrome.runtime.lastError) { /*ignore*/ }

		if (exists === true)
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

// Returns seconds since Unix Epoch.
function getSeconds()
{
	let today = new Date();
	let seconds = Math.floor(today.getTime() / 1000);
	return seconds;
}
