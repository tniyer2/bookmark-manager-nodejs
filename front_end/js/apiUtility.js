
const NEW_TAB = "chrome://newtab/";

function makeRequest(request) {
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

function onMessage(listener) {
	chrome.runtime.onMessage.addListener(listener);
};

function onBrowserAction(listener) {
	chrome.browserAction.onClicked.addListener(listener);
};

function resetContextMenu(cb) {
	chrome.contextMenus.removeAll(cb);
};

function createContextMenu(options) {
	chrome.contextMenus.create(options);
};

function onContextMenuClicked(listener) {
	chrome.contextMenus.onClicked.addListener(listener);
};

function sendMessageToTab(tabId, message, cb) {
	chrome.tabs.sendMessage(tabId, message, cb);
};

function injectScript(tabId, info, cb) {
	chrome.tabs.executeScript(tabId, info, cb);
};

function getURL(url) {
	return chrome.runtime.getURL(url);
};

function updateTab(tabId, info) {
	chrome.tabs.update(tabId, info);
};

function createTab(info) {
	chrome.tabs.create(info);
};

function getLocalData(keys, cb) {
	chrome.storage.local.get(keys, cb);
};

function setLocalData(data, cb) {
	chrome.storage.local.set(data, cb);
};

function download(info) {
	chrome.downloads.download(info);
};

function getLastError() {
	return chrome.runtime.lastError;
};

function getCssDir() {
	return getURL("css");
}

export {
	NEW_TAB,
	makeRequest,
	onMessage,
	onBrowserAction,
	resetContextMenu,
	createContextMenu,
	onContextMenuClicked,
	sendMessageToTab,
	injectScript,
	getURL,
	updateTab,
	createTab,
	getLocalData,
	setLocalData,
	download,
	getLastError,
	getCssDir
};
