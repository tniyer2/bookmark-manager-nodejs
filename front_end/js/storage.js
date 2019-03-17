
const LOCAL_QUOTA = chrome.storage.local.QUOTA_BYTES - 1000;

let glb_meta;

// success: {meta: result of query}
// error: badQuery
async function getMetaLocally(q, successCallback, errorCallback)
{
	if (!glb_meta) glb_meta = await wrap(load).catch(e => errorCallback(e));

	let result;
	try
	{
		result = query(glb_meta.slice(), q);
	}
	catch (e)
	{
		console.warn(e);
		errorCallback({badQuery: true});
		return;
	}
	successCallback({meta: result});
}

// success: success
async function addMetaLocally(meta, successCallback, errorCallback)
{
	if (!glb_meta) glb_meta = await wrap(load).catch(e => errorCallback(e));

	meta.id = getRandomString();
	glb_meta.push(meta);

	let success = await wrap(save).catch(e => errorCallback(e));
	if (success) successCallback({success: true});
}

// success: success
async function deleteMetaLocally(id, successCallback, errorCallback)
{
	let index = await wrap(_pick, id).catch(e => errorCallback(e));

	glb_meta.splice(index, 1);
	let success = await wrap(save).catch(e => errorCallback(e));
	if (success) successCallback({success: true});
}

// success: {content: content retrieved}
async function pickMetaLocally(id, successCallback, errorCallback)
{
	let index = await wrap(_pick, id).catch(e => errorCallback(e));
	let content = glb_meta[index];

	successCallback({content: content});
}

// success: index of the element with the matching id
// error: badQuery
async function _pick(id, successCallback, errorCallback)
{
	if (!glb_meta) glb_meta = await wrap(load).catch(e => errorCallback(e));

	let index = getId(glb_meta, id);

	if (index === -1)
	{
		let e = "Could not find element with id: '" + id + "'";
		console.warn(e);
		errorCallback({badQuery: true});
	}
	else
	{
		successCallback(index);
	}
}

// success: metadata
// error: null
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
			console.warn(e);
			errorCallback(null);
			return;
		}
	}

	successCallback(meta);
}

// success: true 
// error: memoryError, null 
async function save(successCallback, errorCallback)
{
	let serialized = "";
	for (let obj of glb_meta)
	{
		serialized += JSON.stringify(obj) + "\n";
	}

	if (serialized.length > LOCAL_QUOTA)
	{
		errorCallback({memoryError: true});
		return;
	}

	chrome.storage.local.set({meta: serialized}, (response) => {
		if (chrome.runtime.lastError)
		{
			console.warn(chrome.runtime.lastError.message);
			errorCallback(null);
		}
		else
		{
			successCallback(true);
		}
	});
}

// success: data retrieved from storage
// error: null
function storageGetWrapper(keys)
{
	return new Promise((resolve, reject) => {
		chrome.storage.local.get(keys, (response) => {
			if (chrome.runtime.lastError)
			{
				console.warn(chrome.runtime.lastError.message);
				reject(null);
			}
			else
			{
				resolve(response);
			}
		});
	});
}
