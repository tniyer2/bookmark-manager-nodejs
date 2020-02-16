
(function(){

	const GALLERY_URL = ApiUtility.getURL("html/gallery.html"),
		  DEFAULT_SETTINGS = { theme: "light", tagRules: [] };
	const CONTEXT_OPTIONS = { title: "Bookmark",
				   	   		  id: "Save",
				   	   		  contexts: ["image", "video", "page"],
				   	   		  documentUrlPatterns: [ "http://*/*",
				 							  		 "https://*/*",
				 							  		 "data:image/*",
				 							  		 "file://*" ] };
	let	g_requester,
		g_popupInfo = {},
		g_settings;

	return async function() {
		g_requester = new RequestManager();
		try {
			const data = await DataManager.getKeyWrapper("settings");
			g_settings = data.settings || DEFAULT_SETTINGS;
		} catch (e) {
			if (e) console.warn(e);
			console.warn("Failed to retrieve settings from local storage.");
			g_settings = DEFAULT_SETTINGS;
		}

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

			replaceTags(msg.info);
			g_requester.addContent(msg.info, sendResponse, onErr);
		}
		else if (msg.request === "add-content-manually")
		{
			replaceTags(msg.info);
			g_requester.addContent(msg.info, sendResponse, onErr);	
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
			replaceTags(msg.info);
			g_requester.updateContent(msg.id, msg.info, sendResponse, onErr);
		}
		else if (msg.request === "get-settings")
		{
			sendResponse(g_settings);
		}
		else if (msg.request === "update-settings")
		{
			const updatedSettings = U.extend(g_settings, msg.settings);
			DataManager.setKeyWrapper({settings: updatedSettings}).then(() => {
				g_settings = updatedSettings;
				sendResponse();
			}).catch(onErr);
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

	function replaceTags(content) {
		const rules = g_settings.tagRules;
		const tags = content.tags;
		if (rules && rules.length) {
			rules.forEach((r) => {
				const i = tags.findIndex(t => t === r.tag);
				if (i !== -1) {
					tags.splice(i, 1);
					tags.push.apply(tags, r.links);
				}
			});
		}
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

	function openGallery(tab)
	{
		tabUrl = new URL(tab.url);
		const tabUrlWOQuery = tabUrl.origin + tabUrl.pathname;
		const fullGalleryUrl = GALLERY_URL + "?" + "theme=" + g_settings.theme;

		if (tab.url === ApiUtility.NEW_TAB || tabUrlWOQuery === GALLERY_URL) {
			ApiUtility.updateTab(tab.id, {url: fullGalleryUrl});
		} else {
			ApiUtility.createTab({url: fullGalleryUrl});
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
				  		popupId: popupId,
				  		theme: g_settings.theme };
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
