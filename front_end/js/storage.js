
const LOCAL_QUOTA = chrome.storage.local.QUOTA_BYTES - 1000;

let g_meta;

// success: {meta: result of query}
// error: badQuery
async function getMetaLocally(q, successCallback, errorCallback)
{
	if (!g_meta) g_meta = await wrap(load).catch(e => errorCallback(e));

	let result;
	try
	{
		result = query(g_meta.slice(), q);
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
	if (!g_meta) g_meta = await wrap(load).catch(e => errorCallback(e));

	meta.id = getRandomString();
	g_meta.push(meta);

	let success = await wrap(save).catch(e => errorCallback(e));
	if (success) successCallback({success: true});
}

// success: success
async function deleteMetaLocally(id, successCallback, errorCallback)
{
	let index = await wrap(_pick, id).catch(e => errorCallback(e));

	g_meta.splice(index, 1);
	let success = await wrap(save).catch(e => errorCallback(e));
	if (success) successCallback({success: true});
}

// success: {content: content retrieved}
async function pickMetaLocally(id, successCallback, errorCallback)
{
	let index = await wrap(_pick, id).catch(e => errorCallback(e));
	let content = g_meta[index];

	successCallback({content: content});
}

// success: index of the element with the matching id
// error: badQuery
async function _pick(id, successCallback, errorCallback)
{
	if (!g_meta) g_meta = await wrap(load).catch(e => errorCallback(e));

	let index = getId(g_meta, id);

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
// error: error
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
			errorCallback({error: true});
			return;
		}
	}

	successCallback(meta);
}

// success: true
// error: memoryError, error
async function save(successCallback, errorCallback)
{
	let serialized = "";
	for (let obj of g_meta)
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
			errorCallback({error: true});
		}
		else
		{
			successCallback(true);
		}
	});
}

// success: data retrieved from storage
// error: error
function storageGetWrapper(keys)
{
	return new Promise((resolve, reject) => {
		chrome.storage.local.get(keys, (response) => {
			if (chrome.runtime.lastError)
			{
				console.warn(chrome.runtime.lastError.message);
				reject({error: true});
			}
			else
			{
				resolve(response);
			}
		});
	});
}
