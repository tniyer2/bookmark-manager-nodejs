
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
		response.docUrl = glb_popupInfo.srcUrl === sender.tab.url ? "src" : sender.tab.url ;

		response.scanInfo  = glb_popupInfo.scanInfo;
		response.mediaType = glb_popupInfo.mediaType;
		response.tabId	   = sender.tab.id;

		sendResponse(response);
	}
	// msg properties: query
	else if (msg.request === "get-meta")
	{
		let port;
		let final = {};
		let query = msg.query ? msg.query : DEFAULT_QUERY;

		(async () => {

			let port = await wrap(glb_connector.connect
						 	 .bind(glb_connector))
							 .catch(e => console.warn(e));

			if (port)
			{
				let myTag = genTag("get");
				let request = { type: "get", 
								tag: myTag, 
								query: query };
								
				port.postMessage(request);
				port.onMessage.addListener((response) => {
					if (response.tag === myTag)
					{
						addResult(response, true);
					}
				});
			}

			wrap(getMetaLocally, query)
			.then(addResult, addResult);

			function addResult(v, a)
			{
				if (v === undefined)
				{
					throw new Error("result should not be undefined");
				}

				let s = a ? "app" : "local";
				final[s] = v;
				if ((!port && "local" in final) || 
					(port && "local" in final && "app" in final))
				{
					sendResponse(final);
				}
			}
		})();

		return true;
	}
	// msg properties: meta
	else if (msg.request === "add-meta")
	{
		(async () => {

			let port = await wrap(glb_connector.connect
							 .bind(glb_connector))
							 .catch(e => console.warn(e));

			if (port)
			{
				let myTag = genTag("add");
				let appMessage = { type: "add", 
								   tag: myTag, 
								   content: msg.meta, 
								   download: true };

				port.postMessage(appMessage);
				port.onMessage.addListener((response) => {
					if (response.tag === myTag)
					{
						sendResponse(response);
					}
				});
			}
			else
			{
				wrap(addMetaLocally, msg.meta)
				.then(sendRaw, sendRaw);
			}
		})();

		return true;
	}
	// msg properties: id
	else if (msg.request === "pick-meta")
	{
		pickMeta(msg.id, "pick", genTag, (v) => sendResponse(v));
		return true;
	}
	// msg properties: id
	else if (msg.request === "delete-meta")
	{
		pickMeta(msg.id, "delete", genTag, (v) => sendResponse(v));
		return true;
	}
	else
	{
		console.warn("Content script sent unknown message:", msg);
	}

	function sendRaw(e) 
	{ 
		sendResponse(e);
	}

	function genTag(method)
	{
		let ms = new Date().getTime();
		return String(sender.tab.id) + method + ms;
	}
});

// mode can be 'pick' or 'delete'
async function pickMeta(id, mode, genTag, successCallback, errorCallback)
{
	let localFunc;
	if (mode === "pick")
	{
		localFunc = pickMetaLocally;
	}
	else if (mode === "delete")
	{
		localFunc = deleteMetaLocally;
	}
	else
	{
		console.warn("mode should not be", mode);
		errorCallback(null);
		return;
	}

	if (fromApp(id))
	{
		let port = await wrap(glb_connector.connect
					 	 .bind(glb_connector))
						 .catch(e => console.warn(e));

		if (port)
		{
			let myTag = genTag(mode);
			let request = { type: mode, 
							tag: myTag,
							id: id };

			port.postMessage(request);
			port.onMessage.addListener((response) => {
				if (response.tag === myTag)
				{
					successCallback(response);
				}
			});
		}
		else
		{
			console.warn("connection required for " + mode + " mode");
			successCallback({nmError: true});
		}
	}
	else
	{
		wrap(localFunc, id).then(successCallback, successCallback);
	}
}

// Browser action opens up the gallery.
chrome.browserAction.onClicked.addListener((tab) => {
	chrome.tabs.create({url: "html/gallery.html"});
});

// Creates context menu item "Save".
chrome.contextMenus.removeAll(() => {

	let saveInfo = { title: "Save",
					 id:"Save",
					 contexts:["all"],
					 documentUrlPatterns: [ "http://*/*", 
					 						"https://*/*", 
					 						"data:image/*", 
					 						"file://*" ] };

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

// Returns true if id is prefixed with APP_ID_PREFIX
function fromApp(contentId)
{
	let sub = contentId.substring(0, 4);
	return sub === APP_ID_PREFIX;
}
