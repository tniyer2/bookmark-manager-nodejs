
this.ApiUtility = new (function(){
	const self = this;

	this.NEW_TAB = "chrome://newtab/";

	this.makeRequest = function(request) {
		return new Promise((resolve, reject) => {
			chrome.runtime.sendMessage(request, (response) => {
				if (chrome.runtime.lastError)
				{
					console.warn(chrome.runtime.lastError.message);
					reject();
				}
				else
				{
					resolve(response);
				}
			});
		});
	};

	this.onMessage = function(listener) {
		chrome.runtime.onMessage.addListener(listener);
	};

	this.onBrowserAction = function(listener) {
		chrome.browserAction.onClicked.addListener(listener);
	};

	this.resetContextMenu = function(cb) {
		chrome.contextMenus.removeAll(cb);
	};

	this.createContextMenu = function(options) {
		chrome.contextMenus.create(options);
	};

	this.onContextMenuClicked = function(listener) {
		chrome.contextMenus.onClicked.addListener(listener);
	};

	this.sendMessageToTab = function(tabId, message, cb) {
		chrome.tabs.sendMessage(tabId, message, cb);
	};

	this.injectScript = function(tabId, info, cb) {
		chrome.tabs.executeScript(tabId, info, cb);
	};

	this.getURL = function(url) {
		return chrome.runtime.getURL(url);
	};

	this.updateTab = function(tabId, info) {
		chrome.tabs.update(tabId, info);
	};

	this.createTab = function(info) {
		chrome.tabs.create(info);
	};

	this.getLocalData = function(keys, cb) {
		chrome.storage.local.get(keys, cb);
	};

	this.setLocalData = function(data, cb) {
		chrome.storage.local.set(data, cb);
	};

	this.download = function(info) {
		chrome.downloads.download(info);
	};

	Object.defineProperty(this, "lastError", { get: () => {
		return chrome.runtime.lastError;
	}});

	Object.defineProperty(this, "cssDir", { get: () => {
		return self.getURL("css");
	}});
})();
