
const DESKTOP_APPLICATION_NAME = "tagger_plus_desktop";
const DEFAULT_QUERY = "all";
const ID_PREFIX = "app_";
const APP_CONNECT_WAIT = 3 * 1000;

let glb_port;

connectApp((port) => {
	console.log("port:", port);
});

function connectApp(successCallback, errorCallback)
{
	let timeoutId = setTimeout(() => {
		glb_port.onDisconnect.removeListener(listener);
		successCallback(glb_port);
	}, APP_CONNECT_WAIT);

	glb_port = chrome.runtime.connectNative(DESKTOP_APPLICATION_NAME);
	glb_port.onDisconnect.addListener(listener);
	glb_port.onDisconnect.addListener(() => {
		glb_port = null;
	});

	function listener()
	{
		if (chrome.runtime.lastError)
		{
			// console.warn(chrome.runtime.lastError.message);
			clearTimeout(timeoutId);
			successCallback(null);
		}
	}
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
		response.connected = Boolean(glb_port);
		response.tabId	   = sender.tab.id;

		sendResponse(response);
	}
	else if (msg.request === "get-meta")
	{
		let result = [];
		let query  = msg.query ? msg.query : DEFAULT_QUERY;

		(async () => {
			let meta = await wrap(getMetaLocally, query).catch(e => sendResponse(e));
			if (typeof meta === "undefined") return;
			addToResult(meta);
		})();

		if (glb_port)
		{		
			let tag = sender.tab.id + "get" + getSeconds();
			glb_port.postMessage({tag: tag, type: "get", query: query});
			glb_port.onMessage.addListener((response) => {
				if (response.tag === tag)
				{
					addToResult(response.result);
				}
			});
		}

		function addToResult(meta)
		{
			if (!glb_port)
			{
				sendResponse({meta: meta});
				return;
			}
			else
			{
				result.push(meta);
				if (result.length === 2)
				{
					let final = result[0].concat(result[1]);
					sendResponse({meta: final});
				}
			}
		}

		return true;
	}
	else if (msg.request === "add-meta")
	{
		if (glb_port)
		{
			let tag = sender.tab.id + "add" + getSeconds();
			let appMessage = {tag: tag, type: "add", content: msg.meta, download: true};
			glb_port.postMessage(appMessage);
			glb_port.onMessage.addListener((response) => {
				if (response.tag === tag)
				{
					sendResponse({success: true});
				}
			});
		}
		else
		{
			(async () => {
				let success = await wrap(addMetaLocally, msg.meta).catch(e => sendResponse(e));
				if (success !== true) return;
				sendResponse({success: true});
			})();
		}

		return true;
	}
	else if (msg.request === "delete-meta")
	{
		if (fromApp(msg.id))
		{
			if (glb_port)
			{
				let tag = sender.tab.id + "delete" + getSeconds();
				glb_port.postMessage({tag: tag, type: "delete", id: msg.id});
				glb_port.onMessage.addListener((response) => {
					if (response.tag === tag)
					{
						sendResponse({success: true});
					}
				});
			}
			else
			{
				sendResponse({nmError: true});
			}
		}
		else
		{
			(async () => {
				let success = await wrap(deleteMetaLocally, msg.id).catch(e => sendResponse(e));
				if (success !== true) return;
				sendResponse({success: true});
			})();
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

// Returns true if content came from the desktop app
function fromApp(contentId)
{
	let sub = contentId.substring(0, 4);
	return sub === ID_PREFIX;
}
