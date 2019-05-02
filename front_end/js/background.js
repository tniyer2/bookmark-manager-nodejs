
(function(){

	const NEW_TAB = "chrome://newtab/",
		  GALLERY_URL = chrome.runtime.getURL("html/gallery.html"),
		  APP_NAME = "tagger_plus_desktop",
		  APP_TIMEOUT = 1000,
		  MAX_CACHE_DURATION = 120,
		  CONTEXT_OPTIONS = { title: "Save",
				   	   		  id: "Save",
				   	   		  contexts: ["image", "video", "page"],
				   	   		  documentUrlPatterns: [ "http://*/*",
				 							  		 "https://*/*",
				 							  		 "data:image/*",
				 							  		 "file://*" ] };
	let g_connector, 
		g_requester,
		g_recentPopupInfo,
		g_allPopupInfo = {};

	return function() {
		g_connector = new AppConnector(APP_NAME, APP_TIMEOUT);
		g_requester = new RequestManager(g_connector);

		chrome.runtime.onMessage.addListener(handleRequest);
		chrome.browserAction.onClicked.addListener(openGallery);
		chrome.contextMenus.removeAll(() => {
			chrome.contextMenus.create(CONTEXT_OPTIONS);
			chrome.contextMenus.onClicked.addListener(onContextClicked);
		});
	};

	function handleRequest(msg, sender, sendResponse)
	{
		let onErr = (e) => {
			let response = e ? e : {error: true};
			sendResponse(response);
		};

		if (msg.request === "get-popup-info")
		{
			collectPopupInfo(sender, sendResponse, onErr);
		}
		else if (msg.request === "get-tags")
		{
			g_requester.getTags(sendResponse, onErr);
		}
		else if (msg.request === "get-meta")
		{
			g_requester.getContent(sendResponse, onErr);
		}
		else if (msg.request === "add-content")
		{
			let info = g_allPopupInfo[msg.popupId];
			fillInSource(msg.meta, info);

			g_requester.addContent(msg.meta, canCache(msg.meta), sendResponse, onErr);
		}
		else if (msg.request === "find-content")
		{
			g_requester.findContent(msg.id, sendResponse, onErr);
		}
		else if (msg.request === "delete-content")
		{
			g_requester.deleteContent(msg.id, sendResponse, onErr);
		}
		else if (msg.request === "update-content")
		{
			g_requester.updateContent(msg.id, msg.info, sendResponse, onErr);
		}
		else
		{
			console.warn("Content script sent unknown message:", msg);
		}

		return true;
	}

	async function collectPopupInfo(sender, successCallback, errorCallback)
	{
		let info = {};

		info.srcUrl = g_recentPopupInfo.srcUrl;
		info.docUrl = sender.tab.url;
		info.mediaType = g_recentPopupInfo.mediaType;
		info.tabId = sender.tab.id;

		try
		{
			info.scanInfo = await U.wrap(requestScanInfo, sender.tab.id);
			info.tags = await U.bindWrap(g_requester.getTags, g_requester);
		}
		catch (e)
		{
			errorCallback(e);
			return;
		}

		let popupId = U.makeTag(sender.tab.id, "get-popup-info");

		info.popupId = popupId;
		g_allPopupInfo[popupId] = info;

		successCallback(info);
	}

	function fillInSource(content, info)
	{
		content.docUrl = info.docUrl;

		if (content.srcUrl === "srcUrl")
		{
			content.srcUrl = info.srcUrl;
		}
		else if (content.srcUrl === "docUrl")
		{
			content.srcUrl = info.docUrl;
		}
	}

	function canCache(content)
	{
		return content.category === "image" || 
			  (content.category === "video" && 
			   content.duration < MAX_CACHE_DURATION);
	}

	function requestScanInfo(tabId, successCallback, errorCallback)
	{
		chrome.tabs.sendMessage(tabId, {to: "scanner.js", scan: true}, (scanInfo) => {
			if (chrome.runtime.lastError)
			{
				console.warn(chrome.runtime.lastError.message);
				errorCallback(null);
			}
			else
			{
				successCallback(scanInfo);
			}
		});
	}

	function openGallery(tab)
	{
		tabUrl = new URL(tab.url);
		let tabUrlWOQuery = tabUrl.origin + tabUrl.pathname;

		if (tab.url === NEW_TAB || tabUrlWOQuery === GALLERY_URL)
		{
			chrome.tabs.update(tab.id, {url: GALLERY_URL});
		}
		else
		{
			chrome.tabs.create({url: GALLERY_URL});
		}
	}

	function onContextClicked(info, tab)
	{
		g_recentPopupInfo = { srcUrl: info.srcUrl,
							  mediaType: info.mediaType };

		messageScript(tab.id, { to: "content.js",
								script: "js/content.js",
								open: true });
	}

	function messageScript(tabId, msg, callback)
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
})()();
