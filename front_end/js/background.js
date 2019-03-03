
const DEFAULT_TIMEOUT = 10000;
const DEFAULT_PORT    = 50100;
const MAX_PORT        = 50200;

const PROTOCOL		= "http://";
const HOST_NAME     = "localhost";
const CHECK_CONTEXT = "check";
const META_CONTEXT  = "meta";

let glb_popupInfo;
let glb_port = DEFAULT_PORT;
let glb_useLocal = true;

// Listens to messages.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

	if (chrome.runtime.lastError)
	{
		console.warn(chrome.runtime.lastError.message);
		return;
	}

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
		let sendMeta = (meta) => {
			meta = query(meta, msg.query);
			let response = {meta: meta, path: catUrl(glb_port)};
			sendResponse(response);
		};

		if (glb_useLocal)
		{
			getMetaLocally("all", (meta) => {
				sendMeta(meta);
			});
		}
		else
		{
			getMeta("all", (meta) => {
				if (!meta)
				{
					sendResponse({xhrError: true});
					return;
				}

				sendMeta(meta);
			});
		}

		return true;
	}
	else if (msg.request === "upload-meta")
	{
		if (glb_useLocal)
		{
			uploadMetaLocally(msg.meta, (response) => {
				if (response.success)
				{
					sendResponse({success: true});
				}
				else if (response.outOfMemory)
				{
					sendResponse({outOfMemory: true});
				}
				else if (response.lastError)
				{
					console.warn(response.lastError);
				}
				else
				{
					console.warn("Unkown response from uploadMetaLocally callback:");
					console.warn(response);
				}
			});
		}
		else
		{
			uploadMeta(msg.command, msg.meta, "POST", (response) => {
				if (response)
				{
					sendResponse({success: true});
				}
				else
				{
					sendResponse({xhrError: true});
				}
			});
		}

		return true;
	}
	else if (msg.request === "delete-meta")
	{
		if (glb_useLocal)
		{
			deleteMetaLocally(msg.id, (response) => {
				if (response.success)
				{
					sendResponse({success: true});
				}
				else if (response.outOfMemory)
				{
					sendResponse({outOfMemory: true});
				}
				else if (response.lastError)
				{
					console.warn(response.lastError);
				}
				else
				{
					console.warn("Couldn't handle response of deleteMetaLocally callback:");
					console.warn(response);
				}
			});
		}
		else
		{
			deleteMeta(msg.id, (response) => {
				if (response)
				{
					sendResponse({success: true});
				}
				else
				{
					sendResponse({xhrError: true});
				}
			});
		}

		return true;
	}
	else
	{
		console.warn("Content script sent unknown message:");
		console.warn(msg);
	}
});

// browser action opens up the gallery.
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

// Used for retrieving content.
async function getMeta(q, callback)
{
	let port = await getPortWrapper().catch(error => {
		console.warn(error);
		callback(false);
	});
	if (typeof port === "undefined")
		return;

	let url = catUrl(port, META_CONTEXT, q);

	let xhr = new XMLHttpRequest();
	xhr.open("GET", url);
	xhr.onreadystatechange = function()
	{
		if(this.readyState === 4)
		{
			if (this.status === 200)
			{
				let split = xhr.responseText.split("\n").filter(i => i);
				let meta = [];

				for (let i in split)
				{
					meta.push(JSON.parse(split[i]));
				}

				if (callback)
				{
					callback(meta);
				}
			}
			else
			{
				console.warn("Could not get meta from the server.");
			}
		}
	};
	xhr.send();
}

// Used for both uploading and updating content.
async function uploadMeta(command, meta, method, callback)
{
	let commandJSON = JSON.stringify(command);
	let metaJSON 	= JSON.stringify(meta);
	let request 	= commandJSON + "\n" + metaJSON;

	let port = await getPortWrapper().catch(error => {
		console.warn(error);
		callback(false);
	});
	if (typeof port === "undefined")
		return;

	let url  = catUrl(port, META_CONTEXT);

	let xhr  = new XMLHttpRequest();
	xhr.open(method, url);
	xhr.onreadystatechange = function()
	{
		if (this.readyState === 4)
		{
			if (this.status === 200)
			{
				console.log("Uploaded meta.");
				if (callback)
					callback(true);
			}
			else
			{
				console.warn("Could not upload meta. Status: " + this.status);
				if (callback)
					callback(false);
			}
		}
	};
	xhr.send(request);
}

async function deleteMeta(metaId, callback)
{
	let port = await getPortWrapper().catch(error => {
		console.warn(error);
		callback(false);
	});
	if (typeof port === "undefined")
		return;

	let xhr = new XMLHttpRequest();
	xhr.open("DELETE", catUrl(port, META_CONTEXT));
	xhr.onreadystatechange = function()
	{
		if (this.readyState === 4)
		{
			if (this.status === 200)
			{
				if (callback)
					callback(true);
			}
			else
			{
				console.warn("Could not make DELETE request. Status: " + this.status);
				if (callback)
					callback(false);
			}
		}
	};
	xhr.send(JSON.stringify({id: metaId}));
}

function sendMessageToScript(tabId, msg, callback)
{
	chrome.tabs.sendMessage(tabId, {to: msg.to, check: true}, (exists) => {
		if (chrome.runtime.lastError) { /*ignore*/ }

		if (exists)
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

// If port is defined, checks if the current port still works.
// Otherwise, finds the port.
async function getPort(successCallback, errorCallback)
{
	let connects;

	if (glb_port)
	{
		console.log("Checking if port " + glb_port + " connects.");
		try
		{
			connects = await checkPortWrapper(glb_port, CHECK_CONTEXT);
		}
		catch (e)
		{
			if (errorCallback)
				errorCallback(e);
			else
				console.warn(e);
			return;
		}
	}

	if (!glb_port || !connects)
	{
		console.log("Finding port");
		try
		{
			glb_port = await findPortWrapper(DEFAULT_PORT, MAX_PORT);
		}
		catch (e)
		{
			if (errorCallback)
				errorCallback(e);
			else
				console.warn(e);
			return;
		}
	}

	if (successCallback)
	{
		successCallback(glb_port);
	}
}

function getPortWrapper()
{
	return new Promise((resolve, reject) => {
		getPort(response => resolve(response),
				error => reject(error));
	});
}

// successCallback returns the port the server is runnning on.
async function findPort(min, max, successCallback, errorCallback)
{
	let callbacksRecieved = 0;
	for (let port = min; port <= max; port+=1)
	{
		checkPort(port, CHECK_CONTEXT, (response) => {
			if(successCallback && response)
			{
				console.log("Port found: " + response);
				successCallback(response);
			}
			else
			{
				callbacksRecieved += 1;
				if(errorCallback && callbacksRecieved == max - min + 1)
				{
					errorCallback("Could not connect to the server on ports " + min + "-" + max);
				}
			}
		}, (error) => {
			if (errorCallback)
				errorCallback(error);
			else
				console.warn(error);
		});
	}
}

// Wraps findPort in a Promise and returns it.
function findPortWrapper(min, max)
{
	return new Promise((resolve, reject) => {
		findPort(min, max,
			response => resolve(response),
			error => reject(error));
	});
}

// successCallback returns the port if the port exists.
async function checkPort(port, context, successCallback, errorCallback)
{
	let url = catUrl(port, context);
	let errorMessage = url + " timed out after " + (DEFAULT_TIMEOUT/1000) + " seconds.";

	let timeoutID = setTimeout(() => { errorCallback(errorMessage); }, DEFAULT_TIMEOUT);

	let xhr = new XMLHttpRequest();
	xhr.addEventListener("error", () => {
		if (successCallback)
		{
			clearTimeout(timeoutID);
			successCallback(null);
			console.log("Attempting to reach port " + port + " threw an error.");
		}
	});
	xhr.open("HEAD", url);
	xhr.onreadystatechange = function()
	{
		if(this.readyState == 4)
		{
			if(this.status == 200)
			{
				if(successCallback)
				{
					clearTimeout(timeoutID);
					successCallback(port);
					console.log("port " + port + " connected.");
				}
			}
			else
			if(successCallback)
				{
					clearTimeout(timeoutID);
					successCallback(null);
					console.log("port " + port + " responded with status: " + this.status);
				}
		}
	};
	xhr.send();
}

// Wraps checkPort in a Promise and returns it.
function checkPortWrapper(port, context)
{
	return new Promise((resolve, reject) => {
		checkPort(port, context,
			response => resolve(response),
			error => reject(error));
	});
}

function catUrl(port, context, q)
{
	if (context)
	{
		q = q ? "?" + encodeURIComponent(q) : "";
	}
	else
	{
		context = "";
		q = "";
	}
	let url = PROTOCOL + HOST_NAME + ":" + port + "/" + context + q;

	return url;
}
