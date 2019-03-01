
const LOCAL_QUOTA = chrome.storage.local.QUOTA_BYTES - 1000;
const ID_LENGTH = 40;

let glb_meta;

async function deleteMetaLocally(metaId, callback)
{
	if (!glb_meta)
		glb_meta = await loadWrapper().catch(error => console.warn(error));

	let i;
	for (let j = 0; j < glb_meta.length; j++)
	{
		if (glb_meta[j].id == metaId)
		{
			i = j;
			break;
		}
	}

	if (!i && i!==0)
	{
		console.warn("Could not find element with id: '" + metaId + "'");
		return;
	}

	glb_meta.splice(i, 1);
	let success = await saveWrapper().catch(error => callback(error));
	if (success)
		callback({success: success});
}

async function uploadMetaLocally(meta, callback)
{
	if (!glb_meta)
		glb_meta = await loadWrapper().catch(error => console.warn(error));

	meta.id = getRandomString(ID_LENGTH);
	glb_meta.push(meta);
	let success = await saveWrapper().catch(error => callback(error));
	if (success)
		callback({success: true});
}

async function getMetaLocally(q, callback)
{
	if (!glb_meta)
		glb_meta = await loadWrapper().catch(error => console.warn(error));

	callback(query(glb_meta.slice(), q));
}

async function load(successCallback, errorCallback)
{
	let meta = [];

	let serialized = (await storageGetWrapper("meta").catch(error => errorCallback(error))).meta;
	if (!serialized)
	{
		successCallback(meta);
		return;
	}

	for (let s of serialized.split("\n").filter(i => i))
	{
		try
		{
			meta.push(JSON.parse(s));
		}
		catch (e)
		{
			errorCallback(e);
			return;
		}
	}

	successCallback(meta);
}

function loadWrapper()
{
	return new Promise((resolve, reject) => {
		load(response => resolve(response), 
			 error => reject(error));
	});
}

async function save(successCallback, errorCallback)
{
	let serialized = "";
	for (let obj of glb_meta)
	{
		serialized += JSON.stringify(obj) + "\n";
	}
	if (serialized.length > LOCAL_QUOTA)
	{
		errorCallback({outOfMemory: true});
		return;
	}

	chrome.storage.local.set({meta: serialized}, response => {
		if (chrome.runtime.lastError)
		{
			errorCallback({lastError: chrome.runtime.lastError.message});
		}
		else
		{
			successCallback(true);
		}
	});
}

function saveWrapper()
{
	return new Promise((resolve, reject) => {
		save(success => resolve(success), 
			 error => reject(error));
	});
}

function storageGetWrapper(keys)
{
	return new Promise((resolve, reject) => {
		chrome.storage.local.get(keys, (response) => {
			if (chrome.runtime.lastError)
				reject(chrome.runtime.lastError.message);
			else
				resolve(response);
		});
	});
}

function getRandomString(length)
{
	const alphaNumeric = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

	let s = "";
	for (let i = 0; i < length; i++)
	{
		let rand = Math.floor(Math.random() * alphaNumeric.length);
		s += alphaNumeric.charAt(rand);
	}

	return s;
}
