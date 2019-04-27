
this.AppConnector = (function(){
	return class {
		constructor(appName, timeout)
		{
			this._appName = appName;
			this._timeout = timeout;
			this._onDisconnectQueue = [];
		}

		async connect(successCallback)
		{
			if (!this._port)
			{
				this._port = await U.bindWrap(this._getPort, this);

				if (!this._port)
				{
					successCallback(null);
					return;
				}
				else
				{
					this._onConnect(this._port);
				}
			}

			let connected = await U.bindWrap(this._getStatus, this);
			if (connected)
			{
				// console.log("app status: connected");
				this._port.onDisconnect.addListener(() => {
					if (chrome.runtime.lastError)
					{
						console.warn(chrome.runtime.lastError.message);
					}
					this._port = null;
				});
				successCallback(this._port);
			}
			else
			{
				// console.log("app status: disconnected");
				successCallback(null);
			}
		}

		async getStatus(successCallback)
		{
			if (this._port)
			{
				_getStatus(successCallback);
			}
			else
			{
				successCallback(false);
			}
		}

		// callback returns false if nm process disconnects, true if app disconnects.
		onDisconnect(callback)
		{
			if (this._port)
			{
				this._attachOnDisconnect(this._port, callback);
				return true;
			}
			else
			{
				this._onDisconnectQueue.push(callback);
				return false;
			}
		}

		_onConnect(port)
		{
			for (let i = 0, l = this._onDisconnectQueue.length; i < l; i+=1)
			{
				this._attachOnDisconnect(port, this._onDisconnectQueue[i]);
			}
		}

		_attachOnDisconnect(port, callback)
		{
			port.onDisconnect.addListener(() => {
				callback(false);
			});
			port.onMessage.addListener((message) => {
				if (message.tag === "autostatus")
				{
					if (message.status === "disconnected")
					{
						callback(true);
					}
				}
			});
		}

		async _getPort(successCallback)
		{
			let timeoutId = setTimeout(() => {
				port.onDisconnect.removeListener(l);
				successCallback(port);
			}, this._timeout);

			let port = chrome.runtime.connectNative(this._appName);
			port.onDisconnect.addListener(l);

			function l()
			{
				if (chrome.runtime.lastError)
				{
					console.warn(chrome.runtime.lastError.message);
				}
				clearTimeout(timeoutId);
				port.onDisconnect.removeListener(l);
				successCallback(null);
			}
		}

		async _getStatus(successCallback, errorCallback)
		{
			if (!this._port)
			{
				console.warn("this.port is", this._port);
				successCallback(false);
				return;
			}

			this._port.postMessage("status");
			this._port.onMessage.addListener(l);

			function l(response, port)
			{
				if (response.tag !== "status")
				{
					return;
				}

				port.onMessage.removeListener(l);
				if (response.status === "connected")
				{
					successCallback(true);
				}
				else if (response.status === "disconnected")
				{
					successCallback(false);
				}
				else
				{
					console.warn("unknown response:", response);
					successCallback(false);
				}
			}
		}
	};
})();

this.DataManager = new (function(){
	const TAG_KEY = "tags";
	const ID_LENGTH = 40;

	let INNER_INSTANCE;

	Object.defineProperty(this, "instance", { get: () => {
		return new Promise((resolve, reject) => {
			if (INNER_INSTANCE)
			{
				resolve(INNER_INSTANCE);
			}
			else
			{
				(async () => {
					let meta = await U.wrap(load).catch(reject);
					if (U.isUdf(meta)) return;

					INNER_INSTANCE = new Inner(meta);
					resolve(INNER_INSTANCE);
				})();
			}
		});
	}});

	class Inner {
		constructor(meta)
		{
			this._tagTracker = new MetaUtility.TagCounter();

			meta.forEach((content) => {
				this._tagTracker.increment(content[TAG_KEY]);
			});
			this._meta = meta;
		}

		get tags()
		{
			return this._tagTracker.tags;
		}

		get meta()
		{
			return this._meta;
		}

		async addContent(content, successCallback, errorCallback)
		{
			content.id = MetaUtility.getRandomString(ID_LENGTH);
			this._meta.push(content);

			let success = await U.wrap(save, this._meta).catch(errorCallback);
			if (U.isUdf(success))
			{
				this._meta.pop();
				return;
			}

			this._tagTracker.increment(content[TAG_KEY]);

			successCallback({success: true});
		}

		async deleteContent(contentId, successCallback, errorCallback)
		{
			let {content, index} = MetaUtility.searchId(this._meta, contentId);
			if (content)
			{
				this._meta.splice(index, 1);
				this._tagTracker.decrement(content[TAG_KEY]);

				save(this._meta, () => {
					successCallback({success: true});
				}, errorCallback);
			}
			else
			{
				errorCallback({notFound: true});
			}
		}

		async findContent(contentId, successCallback, errorCallback)
		{
			let {content} = MetaUtility.searchId(this._meta, contentId);
			if (content)
			{
				successCallback({content: content});
			}
			else
			{
				errorCallback({notFound: true});
			}
		}

		async updateContent(contentId, info, successCallback, errorCallback)
		{
			let {content, index} = MetaUtility.searchId(this._meta, contentId);
			if (content)
			{
				if (info[TAG_KEY])
				{
					this._tagTracker.decrement(content[TAG_KEY]);
					this._tagTracker.increment(info[TAG_KEY]);
				}

				delete info.id;
				this._meta[index] = U.extend(content, info);

				save(this._meta, () => {
					successCallback({success: true});
				}, errorCallback);
			}
			else
			{
				errorCallback({notFound: true});
			}
		}
	}

	async function load(successCallback, errorCallback)
	{
		let data = await getKeyWrapper("meta").catch(errorCallback);
		if (U.isUdf(data)) return;

		let serialized = data.meta;
		if (!serialized)
		{
			successCallback([]);
			return;
		}

		let meta = [];
		let list = serialized.split("\n").filter(o => o);
		for (let i = 0, l = list.length; i < l; i+=1)
		{
			let s = list[i];
			try
			{
				let content = JSON.parse(s);
				meta.push(content);
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

	// throws {memmoryError}
	async function save(meta, successCallback, errorCallback)
	{
		let serialized = "";
		for (let i = 0, l = meta.length; i < l; i+=1)
		{
			let content = meta[i];
			serialized += JSON.stringify(content) + "\n";
		}

		chrome.storage.local.set({meta: serialized}, (response) => {
			if (chrome.runtime.lastError)
			{
				console.warn(chrome.runtime.lastError.message);
				errorCallback({memoryError: true});
			}
			else
			{
				successCallback(true);
			}
		});
	}

	function getKeyWrapper(keys)
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
})();

this.RequestManager = (function(){
	const APP_ID_PREFIX = "app_";
	const TITLE_KEY = "title";

	const GET_TYPE = "get";
	const ADD_TYPE = "add";
	const FIND_TYPE = "find";
	const DELETE_TYPE = "delete";
	const UPDATE_TYPE = "update";

	return class {
		constructor(connector)
		{
			this._connector = connector;
			this._appCount = 0;
		}

		get appCount()
		{
			this._appCount += 1;
			return this._appCount;
		}

		async getContent(successCallback, errorCallback)
		{
			let dm = await DataManager.instance.catch(errorCallback);
			if (U.isUdf(dm)) return;

			let final = {local: {meta: dm.meta}};

			let tag = U.makeTag(GET_TYPE, this.appCount);
			let request = {type: GET_TYPE, tag: tag};
			let response = await U.bindWrap(this._requestApp, this, request).catch(U.noop);
			if (response)
			{
				final.app = response;
			}

			successCallback(final);
		}

		async addContent(content, cache, successCallback, errorCallback)
		{
			let tag = U.makeTag(ADD_TYPE, this.appCount);
			let request = { type: ADD_TYPE,
							tag: tag,
							content: content,
							download: cache };
			let response = await U.bindWrap(this._requestApp, this, request).catch(U.noop);
			if (response)
			{
				successCallback(response);
			}
			else
			{
				let dm = await DataManager.instance.catch(errorCallback);
				if (U.isUdf(dm)) return;

				dm.addContent(content, successCallback, errorCallback);
			}
		}

		async findContent(contentId, successCallback, errorCallback)
		{
			this._findContent(FIND_TYPE, contentId, null, successCallback, (dm) => {
				dm.findContent(contentId, successCallback, errorCallback);
			}, errorCallback);
		}

		async deleteContent(contentId, successCallback, errorCallback)
		{
			this._findContent(DELETE_TYPE, contentId, null, successCallback, (dm) => {
				dm.deleteContent(contentId, successCallback, errorCallback);
			}, errorCallback);
		}

		async updateContent(contentId, updateInfo, successCallback, errorCallback)
		{
			this._findContent(UPDATE_TYPE, contentId, updateInfo, successCallback, (dm) => {
				dm.updateContent(contentId, updateInfo, successCallback, errorCallback);
			}, errorCallback);
		}

		async _findContent(type, contentId, updateInfo, appCallback, localCallback, errorCallback)
		{
			if (fromApp(contentId))
			{
				let tag = U.makeTag(type, this.appCount);

				let request = { tag: tag,
								type: type,
								id: contentId };
				if (updateInfo)
				{
					request.info = updateInfo;
				}

				this._requestApp(request, appCallback, () => {
					errorCallback({connectionRequired: true});
				});
			}
			else
			{
				DataManager.instance.then(localCallback).catch(errorCallback);
			}
		}

		async getTags(successCallback, errorCallback)
		{
			let dm = await DataManager.instance.catch(errorCallback);
			if (U.isUdf(dm)) return;

			let localTags = dm.tags;

			let tag = U.makeTag("tags", this.appCount);
			let request = {type: "tags", tag: tag};
			let response = await U.bindWrap(this._requestApp, this, request).catch(U.noop);
			if (response)
			{
				let concat = response.tags.concat(localTags);
				let tags = U.removeDuplicates(concat);

				successCallback(tags);
			}
			else
			{
				successCallback(localTags);
			}
		}

		async _requestApp(request, successCallback, errorCallback)
		{
			if (!request.tag)
			{
				console.warn("aborting request to app. request does not have a tag property:", request);
				errorCallback(null);
				return;
			}

			let port = await U.bindWrap(this._connector.connect,
									  this._connector);

			if (port)
			{
				port.postMessage(request);
				port.onMessage.addListener( function listener(response) {
					if (response.tag === request.tag)
					{
						port.onMessage.removeListener(listener);
						successCallback(response);
					}
				});
			}
			else
			{
				errorCallback(null);
			}
		}
	};

	function fromApp(contentId)
	{
		let sub = contentId.substring(0, 4);
		return sub === APP_ID_PREFIX;
	}
})();
