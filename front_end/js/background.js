
const DESKTOP_APPLICATION_NAME = "tagger_plus_desktop";
const DEFAULT_QUERY = "all";
const APP_ID_PREFIX = "app_";

const glb_connector = new AppConnector(DESKTOP_APPLICATION_NAME);

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
		let port;
		let result = [];
		let query  = msg.query ? msg.query : DEFAULT_QUERY;

		(async () => {
			port = await wrap(glb_connector.connect.bind(glb_connector));
			if (port)
			{
				let tag = sender.tab.id + "get" + getSeconds();
				port.postMessage({type: "get", tag: tag, query: query});
				port.onMessage.addListener((response) => {
					if (response.tag === tag)
					{
						addToResult(response.result);
					}
				});
			}

			let localMeta = await wrap(getMetaLocally, query)
								 .catch(e => sendResponse(e));
			if (typeof localMeta === "undefined") return;
			addToResult(localMeta);
		})();


		function addToResult(meta)
		{
			if (!port)
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
		(async () => {
			let port = await wrap(glb_connector.connect
									.bind(glb_connector));
			if (port)
			{
				let tag = sender.tab.id + "add" + getSeconds();
				let appMessage = { type: "add", 
								   tag: tag, 
								   content: msg.meta, 
								   download: true };

				port.postMessage(appMessage);
				port.onMessage.addListener((response) => {
					if (response.tag === tag)
					{
						sendResponse({success: true});
					}
				});
			}
			else
			{
				let success = await wrap(addMetaLocally, msg.meta)
									.catch(e => sendResponse(e));
				if (success)
				{ 
					sendResponse({success: true});
				}
			}
		})();

		return true;
	}
	else if (msg.request === "delete-meta")
	{
		(async () => {
			if (fromApp(msg.id))
			{
				let port = await wrap(glb_connector.connect.bind(glb_connector));
				if (port)
				{
					let tag = sender.tab.id + "delete" + getSeconds();
					port.postMessage({type: "delete", tag: tag, id: msg.id});
					port.onMessage.addListener((response) => {
						if (response.tag === tag)
						{
							sendResponse({success: true});
						}
					});
				}
				else
				{
					sendResponse(null);
				}
			}
			else
			{
				let success = await wrap(deleteMetaLocally, msg.id)
									.catch(e => sendResponse(e));
				if (success)
				{
					sendResponse({success: true});
				}
			}
		})();
 
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
	return sub === APP_ID_PREFIX;
}
