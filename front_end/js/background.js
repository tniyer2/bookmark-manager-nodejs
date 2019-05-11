
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
		g_popupInfo = {};

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
		if (msg.to !== "background.js")
		{
			return;
		}

		let onErr = sendResponse;

		if (msg.request === "get-popup-info")
		{
			collectPopupInfo(msg.popupId, sender, sendResponse, onErr);
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
			let info = g_popupInfo[msg.popupId];
			fillInSource(msg.info, info);

			g_requester.addContent(msg.info, canCache(msg.info), sendResponse, onErr);
		}
		else if (msg.request === "add-content-manually")
		{
			g_requester.addContent(msg.info, canCache(msg.info), sendResponse, onErr);	
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

	async function collectPopupInfo(popupId, sender, cb, onErr)
	{
		let info = g_popupInfo[popupId];
		info.docUrl = sender.tab.url;

		let scanInfoPromise = U.wrap(requestScanInfo, sender.tab.id);
		let tagsPromise = U.bindWrap(g_requester.getTags, g_requester);
		let all = Promise.all([scanInfoPromise, tagsPromise]);
		let results = await all.catch(onErr);
		if (U.isUdf(results)) return;

		info.scanInfo = results[0];
		info.tags = results[1];

		cb(info);
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

	function requestScanInfo(tabId, cb, onErr)
	{
		chrome.tabs.sendMessage(tabId, {to: "scanner.js", scan: true}, (scanInfo) => {
			if (chrome.runtime.lastError)
			{
				console.warn(chrome.runtime.lastError.message);
				onErr();
			}
			else
			{
				cb(scanInfo);
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
		let popupId = U.makeTag(tab.id, "popupId");
		g_popupInfo[popupId] = { srcUrl: info.srcUrl,
							  	 mediaType: info.mediaType };

		let message = { to: "content.js",
				  		open: true,
				  		tabId: tab.id,
				  		popupId: popupId };
		onScriptLoad(tab.id, "content.js", "js/content.js", message);
	}

	function onScriptLoad(tabId, to, script, message, cb)
	{
		chrome.tabs.sendMessage(tabId, {to: to, check: true}, (exists) => {
			if (chrome.runtime.lastError) { /*ignore*/ }
			let send = () => {
				chrome.tabs.sendMessage(tabId, message, cb); 
			};

			if (exists === true)
			{
				send();
			}
			else
			{
				chrome.tabs.executeScript(tabId, {file: script}, send);
			}
		});
	}
})()();
