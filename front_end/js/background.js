
(function(){

	const GALLERY_URL = ApiUtility.getURL("html/gallery.html"),
		  APP_NAME = "tagger_plus_desktop",
		  MAX_CACHE_DURATION = 120,
		  CONTEXT_OPTIONS = { title: "Save",
				   	   		  id: "Save",
				   	   		  contexts: ["image", "video", "page"],
				   	   		  documentUrlPatterns: [ "http://*/*",
				 							  		 "https://*/*",
				 							  		 "data:image/*",
				 							  		 "file://*" ] },
		  DEFAULT_SETTINGS = { enableNativeMessaging: false };

	let	g_settings,
		g_connector, 
		g_requester,
		g_popupInfo = {};

	return async function() {
		g_settings = await DataManager.getKeyWrapper("settings")
						  .then(d => d.settings ? d.settings : DEFAULT_SETTINGS)
						  .catch(() => DEFAULT_SETTINGS);

		g_connector = new AppConnector(APP_NAME);
		g_requester = new RequestManager(g_connector, { enableNativeMessaging: g_settings.enableNativeMessaging });

		ApiUtility.onMessage(handleRequest);
		ApiUtility.onBrowserAction(openGallery);
		ApiUtility.resetContextMenu(() => {
			ApiUtility.createContextMenu(CONTEXT_OPTIONS);
			ApiUtility.onContextMenuClicked(onContextClicked);
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
		else if (msg.request === "get-settings")
		{
			sendResponse(g_settings);
			return false;
		}
		else if (msg.request === "update-settings")
		{
			let updated = U.extend(g_settings, msg.settings);
			DataManager.setKeyWrapper({settings: updated}).then(() => {
				onSettingsUpdate(updated);
				sendResponse();
			}, onErr);
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
		ApiUtility.sendMessageToTab(tabId, {to: "scanner.js", scan: true}, (scanInfo) => {
			if (ApiUtility.lastError)
			{
				console.warn(ApiUtility.lastError.message);
				onErr();
			}
			else
			{
				cb(scanInfo);
			}
		});
	}

	function onSettingsUpdate(settings)
	{
		g_settings = settings;
		g_requester.setOptions({ enableNativeMessaging: g_settings.enableNativeMessaging });
	}

	function openGallery(tab)
	{
		tabUrl = new URL(tab.url);
		let tabUrlWOQuery = tabUrl.origin + tabUrl.pathname;

		if (tab.url === ApiUtility.NEW_TAB || tabUrlWOQuery === GALLERY_URL)
		{
			ApiUtility.updateTab(tab.id, {url: GALLERY_URL});
		}
		else
		{
			ApiUtility.createTab({url: GALLERY_URL});
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
		ApiUtility.sendMessageToTab(tabId, {to: to, check: true}, (exists) => {
			if (ApiUtility.lastError) { /*ignore*/ }
			let send = () => {
				ApiUtility.sendMessageToTab(tabId, message, cb); 
			};

			if (exists === true)
			{
				send();
			}
			else
			{
				ApiUtility.injectScript(tabId, {file: script}, send);
			}
		});
	}
})()();
