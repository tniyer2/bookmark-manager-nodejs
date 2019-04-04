
(function(){
	const DESKTOP_APPLICATION_NAME = "tagger_plus_desktop";
	const DEFAULT_QUERY = "dsc=date";
	const APP_ID_PREFIX = "app_";

	const g_connector = new AppConnector(DESKTOP_APPLICATION_NAME);
	let g_recentPopupInfo;
	let g_allPopupInfo = {};

	// Listens to messages.
	chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
		(async () => {
			if (msg.request === "get-popup-info")
			{
				let info = {};

				info.srcUrl = g_recentPopupInfo.srcUrl;
				info.docUrl = sender.tab.url;
				info.mediaType = g_recentPopupInfo.mediaType;
				info.tabId = sender.tab.id;

				info.scanInfo = await wrap(requestScanInfo, sender.tab.id);
				info.tags = await wrap(getTags, sender);

				info.popupId = makeTag(sender.tab.id, "get-popup-info");
				g_allPopupInfo[info.popupId] = info;

				sendResponse(info);
			}
			else if (msg.request === "get-meta")
			{
				let query = msg.query ? msg.query : DEFAULT_QUERY;
				getContent(query, sender, sendResponse);
			}
			else if (msg.request === "add-meta")
			{
				let info = g_allPopupInfo[msg.popupId];

				msg.meta.docUrl = info.docUrl;
				if (msg.meta.srcUrl === "srcUrl")
				{
					msg.meta.srcUrl = info.srcUrl;
				}
				else if (msg.meta.srcUrl === "docUrl")
				{
					msg.meta.srcUrl = info.docUrl;
				}
				addContent(msg.meta, msg.cache, sender, sendResponse);
			}
			else if (msg.request === "find-meta")
			{
				findContent(msg.id, "find", sender, sendResponse);
			}
			else if (msg.request === "delete-meta")
			{
				findContent(msg.id, "delete", sender, sendResponse);
			}
			else
			{
				console.warn("Content script sent unknown message:", msg);
			}
		})();

		return true;
	});

	// Browser action opens up the gallery.
	chrome.browserAction.onClicked.addListener((tab) => {
		chrome.tabs.create({url: "html/gallery.html"});
	});

	// Creates context menu item "Save".
	chrome.contextMenus.removeAll(() => {

		let saveInfo = { title: "Save",
						 id: "Save",
						 contexts: ["image", "video", "page"],
						 documentUrlPatterns: [ "http://*/*",
						 						"https://*/*",
						 						"data:image/*",
						 						"file://*" ] };

		chrome.contextMenus.create(saveInfo);
	});

	// Activates popup when context menu item "Save" is clicked.
	chrome.contextMenus.onClicked.addListener((info, tab) => {

		g_recentPopupInfo = { srcUrl: info.srcUrl,
							  mediaType: info.mediaType };

		sendMessageToScript(tab.id, { to: "content.js", 
									  script: "js/content.js", 
									  open: true });
	});

	async function getContent(query, sender, successCallback, errorCallback)
	{
		let port;
		let final = {};

		function addResult(v, a)
		{
			if (!v)
			{
				throw new Error("result should not be " + v);
			}

			let s = a ? "app" : "local";
			final[s] = v;
			if ((!port && final.local) ||
				(port && final.local && final.app))
			{
				successCallback(final);
			}
		}

		port = await wrap(g_connector.connect
					 .bind(g_connector))
					 .catch(e => console.warn(e));

		if (port)
		{
			let myTag = makeTag(sender.tab.id, "get");
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

		let op = await DataManager.Operator;
		op.getContent(query, addResult, addResult);
	}

	async function addContent(content, cache, sender, successCallback, errorCallback)
	{
		let port = await wrap(g_connector.connect
				 		 .bind(g_connector))
				 		 .catch(e => console.warn(e));

		if (port)
		{
			let myTag = makeTag(sender.tab.id, "add");
			let appMessage = { type: "add",
							   tag: myTag,
							   content: content,
							   download: cache };

			port.postMessage(appMessage);
			port.onMessage.addListener((response) => {
				if (response.tag === myTag)
				{
					successCallback(response);
				}
			});
		}
		else
		{
			let op = await DataManager.Operator;
			op.addContent(content, successCallback, successCallback);
		}
	}

	// mode can be 'get' or 'delete'.
	async function findContent(contentId, mode, sender, successCallback, errorCallback)
	{
		let modeIsFind   = mode === "find";
		let modeIsDelete = mode === "delete";

		if (!modeIsFind && !modeIsDelete)
		{
			console.warn("mode should not be:", mode);
			errorCallback(null);
			return;
		}

		if (fromApp(contentId))
		{
			let port = await wrap(g_connector.connect
							 .bind(g_connector))
							 .catch(e => console.warn(e));

			if (port)
			{
				let myTag = makeTag(sender.tab.id, mode);
				let request = { type: mode,
								tag: myTag,
								id: contentId };

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
				console.warn(`Cannot connect to app. Connection required 
							  for '${mode}' mode.`);
				successCallback({nmError: true});
			}
		}
		else
		{
			let op = await DataManager.Operator;
			if (modeIsFind)
			{
				op.findContent(contentId, successCallback, successCallback);
			}
			else if (modeIsDelete)
			{
				op.deleteContent(contentId, successCallback, successCallback);
			}
			else {/*should already be handled*/}
		}
	}

	async function getTags(sender, successCallback, errorCallback)
	{
		let op = await DataManager.Operator;
		let localTags = op.tags;

		let port = await wrap(g_connector.connect
						 .bind(g_connector))
						 .catch(e => console.warn(e));
		if (port)
		{
			let myTag = makeTag(sender.tab.id, "tags");
			let request = { type: "tags",
							tag: myTag };

			port.postMessage(request);
			port.onMessage.addListener((response) => {
				if (response.tag === myTag)
				{
					let obj = {};
					let f = (tag) => {obj[tag] = true;};
					localTags.forEach(f);
					response.tags.forEach(f);
					let tags = Object.keys(obj);
					successCallback(tags);
				}
			});
		}
		else
		{
			successCallback(localTags);
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

	// Returns true if id is prefixed with APP_ID_PREFIX.
	function fromApp(contentId)
	{
		let sub = contentId.substring(0, 4);
		return sub === APP_ID_PREFIX;
	}

	function makeTag(tabId, method)
	{
		let ms = new Date().getTime();
		return String(tabId) + method + ms;
	}
}).call(this);
