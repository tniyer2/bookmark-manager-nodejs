
const LOCAL_QUOTA = chrome.storage.local.QUOTA_BYTES - 1000;

let glb_meta;

async function getMetaLocally(q, successCallback, errorCallback)
{
	if (!glb_meta) glb_meta = await wrap(load).catch(e => errorCallback(e));

	let result = query(glb_meta.slice(), q);
	successCallback(result);
}

async function addMetaLocally(meta, successCallback, errorCallback)
{
	if (!glb_meta) glb_meta = await wrap(load).catch(e => errorCallback(e));

	meta.id = getRandomString();
	glb_meta.push(meta);

	let success = await wrap(save).catch(e => errorCallback(e));
	if (success) successCallback(true);
}

async function deleteMetaLocally(id, successCallback, errorCallback)
{
	if (!glb_meta) glb_meta = await wrap(load).catch(e => errorCallback(e));

	let i = searcher.getId(id);

	if (typeof i === "undefined")
	{
		console.warn("Could not find element with id: '" + id + "'");
		return;
	}

	glb_meta.splice(i, 1);
	let success = await wrap(save).catch(e => errorCallback(e));
	if (success) successCallback(true);
}

async function load(successCallback, errorCallback)
{
	let meta = [];

	let data = await storageGetWrapper("meta").catch(e => errorCallback(e));
	let serialized = data.meta;
	if (!serialized)
	{
		successCallback(meta);
		return;
	}

	for (let s of serialized.split("\n").filter(i => i))
	{
		try
		{
			let obj = JSON.parse(s);
			meta.push(obj);
		}
		catch (e)
		{
			errorCallback({jsonError: true});
			return;
		}
	}

	successCallback(meta);
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

	chrome.storage.local.set({meta: serialized}, (response) => {
		if (chrome.runtime.lastError)
		{
			console.warn(chrome.runtime.lastError.message);
			errorCallback({storageError: true});
		}
		else
		{
			successCallback(true);
		}
	});
}

function storageGetWrapper(keys)
{
	return new Promise((resolve, reject) => {
		chrome.storage.local.get(keys, (response) => {
			if (chrome.runtime.lastError)
			{
				console.warn(chrome.runtime.lastError.message);
				reject({storageError: true});
			}
			else
			{
				resolve(response);
			}
		});
	});
}
