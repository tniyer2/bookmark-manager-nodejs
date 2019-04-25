
(function(){

	const GALLERY_URL = chrome.runtime.getURL("html/gallery.html");
	const NEW_TAB = "chrome://newtab/";
	const CONTEXT_OPTIONS = { title: "Save",
				   	   		  id: "Save",
				   	   		  contexts: ["image", "video", "page"],
				   	   		  documentUrlPatterns: [ "http://*/*",
				 							  		 "https://*/*",
				 							  		 "data:image/*",
				 							  		 "file://*" ] };

	const g_connector = new AppConnector("tagger_plus_desktop", 1000);
	const g_requester = new RequestManager(g_connector);

	let g_recentPopupInfo;
	let g_allPopupInfo = {};

	chrome.runtime.onMessage.addListener((m, s, cb) => {
		(async() => {
			serveRequest(m, s, cb);
		})();
		return true;
	});
	chrome.browserAction.onClicked.addListener(openGallery);
	chrome.contextMenus.removeAll(() => {
		chrome.contextMenus.create(CONTEXT_OPTIONS);
	});
	chrome.contextMenus.onClicked.addListener(onContextClicked);

	function serveRequest(msg, sender, sendResponse)
	{
		let onErr = (e) => {
			let response = e ? e : {error: true};
			sendResponse(response);
		};

		if (msg.request === "get-popup-info")
		{
			getPopupInfo(sender, sendResponse, onErr);
		}
		else if (msg.request === "get-tags")
		{
			g_requester.getTags(sendResponse, onErr);
		}
		else if (msg.request === "get-meta")
		{
			g_requester.getContent(sendResponse, onErr);
		}
		else if (msg.request === "add-meta")
		{
			let info = g_allPopupInfo[msg.popupId];
			fillInSource(msg.meta, info);

			g_requester.addContent(msg.meta, msg.cache, sendResponse, onErr);
		}
		else if (msg.request === "find-meta")
		{
			g_requester.findContent(msg.id, sendResponse, onErr);
		}
		else if (msg.request === "delete-meta")
		{
			g_requester.deleteContent(msg.id, sendResponse, onErr);
		}
		else if (msg.request === "update-meta")
		{
			g_requester.updateContent(msg.id, msg.info, sendResponse, onErr);
		}
		else
		{
			console.warn("Content script sent unknown message:", msg);
		}
	}

	async function getPopupInfo(sender, successCallback, errorCallback)
	{
		let info = {};

		info.srcUrl = g_recentPopupInfo.srcUrl;
		info.docUrl = sender.tab.url;
		info.mediaType = g_recentPopupInfo.mediaType;
		info.tabId = sender.tab.id;

		try
		{
			info.scanInfo = await wrap(requestScanInfo, sender.tab.id);
			info.tags = await bindWrap(g_requester.getTags, g_requester);
		}
		catch (e)
		{
			errorCallback(e);
			return;
		}

		let popupId = makeTag(sender.tab.id, "get-popup-info");

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

		if (tabUrl.href === NEW_TAB || tabUrlWOQuery === GALLERY_URL)
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
}).call(this);
