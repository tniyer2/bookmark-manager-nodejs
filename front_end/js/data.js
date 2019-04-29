
this.AppConnector = (function(){
	return class {
		constructor(appName, timeout)
		{
			this._appName = appName;
			this._timeout = timeout;

			this._appConnected = false;
			this._port = null;
			this._waiting = false;
			this._messageQueue = [];
		}

		get portConnected()
		{
			return Boolean(this._port);
		}

		get appConnected()
		{
			return this._appConnected;
		}

		postMessage(message, tag, cb, onErr)
		{
			if (typeof tag !== "string" || tag === "status" || tag === "autostatus")
			{
				console.warn("tag is either invalid or reserved:", tag);
				onErr();
			}
			else if (this._appConnected)
			{
				this._messageQueue.push(arguments);
				this._updateMessageQueue();
			}
			else
			{
				console.warn("cannot call postMessage when app is not connected.");
				onErr();
			}
		}

		_updateMessageQueue()
		{
			if (!this._waiting)
			{
				let params = this._messageQueue[0];
				if (params)
				{
					let [message, tag, cb, onErr] = params;
					this._messageQueue.splice(0, 1);
					this._waiting = true;
					U.bindWrap(this._postMessage, this, message, tag).finally(() => {
						this._waiting = false;
						this._updateMessageQueue();
					}).then(cb, onErr);
				}
			}
		}

		_postMessage(message, tag, cb, onErr)
		{
			let returned = false;

			let onDisconnect = () => {
				if (chrome.runtime.lastError) { /*ignore*/ }
				if (returned) return;

				wrapper(onErr);
			};
			let onAppDisconnect = (message) => {
				if (returned) return;

				if (message.tag === "autostatus" && message.status === "disconnected")
				{
					wrapper(onErr);
				}
			};
			let onResponse = (message) => {
				if (returned) return;

				if (message.tag === tag)
				{
					wrapper(() => {
						cb(message.message);
					});
				}
			};

			let wrapper = (cb) => {
				returned = true;
				this._port.onDisconnect.removeListener(onDisconnect);
				this._port.onMessage.removeListener(onAppDisconnect);
				this._port.onMessage.removeListener(onResponse);
				cb();
			};

			this._port.onDisconnect.addListener(onDisconnect);
			this._port.onMessage.addListener(onAppDisconnect);
			this._port.onMessage.addListener(onResponse);
			this._port.postMessage(message);
		}

		connect(cb)
		{
			if (this._port)
			{
				cb(true);
			}
			else
			{
				this._connect(cb);
			}
		}

		async _connect(cb)
		{
			let listener;
			let port = chrome.runtime.connectNative(this._appName);

			let timeout = new Promise((resolve) => {
				setTimeout(() => {
					resolve(true);
				}, this._timeout);
			});
			let disconnect = new Promise((resolve) => {
				listener = () => {
					if (chrome.runtime.lastError)
					{
						console.warn(chrome.runtime.lastError.message);
					}
					resolve(false);
				};
				port.onDisconnect.addListener(listener);
			});

			let usePort = await Promise.race([timeout, disconnect]);
			port.onDisconnect.removeListener(listener);
			if (usePort)
			{
				this._port = port;
				this._initPort(cb);
			}
			else
			{
				this._port = null;
				cb(false);
			}
		}

		_initPort(cb)
		{
			this._port.onDisconnect.addListener(() => {
				if (chrome.runtime.lastError)
				{
					console.warn(chrome.runtime.lastError.message);
				}
				this._appConnected = false;
				this._port = null;
			});
			this._port.onMessage.addListener(console.log.bind(console, "message:"));
			this._port.onMessage.addListener((message) => {
				if (message.tag === "autostatus")
				{
					if (message.status === "connected")
					{
						this._onAppConnect();
					}
					else if (message.status === "disconnected")
					{
						this._onAppDisconnect();
					}
				}
			});
			U.bindWrap(this._getStatus, this).then((appStatus) => {
				if (appStatus) {
					this._onAppConnect();
				} else {
					this._onAppDisconnect();
				}
				return appStatus;
			}).then(cb);
		}

		_getStatus(cb)
		{
			let listener = (message) => {
				if (message.tag === "status")
				{
					this._port.onMessage.removeListener(listener);
					if (message.status === "connected")
					{
						cb(true);
					}
					else if (message.status === "disconnected")
					{
						cb(false);
					}
					else
					{
						console.warn("could not handle status message:", message);
						cb(false);
					}
				}
			};
			this._port.onMessage.addListener(listener);
			this._port.postMessage("status");
		}

		_onAppConnect()
		{
			this._appConnected = true;
		}

		_onAppDisconnect()
		{
			this._appConnected = false;
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

		async addContent(content, cb, onErr)
		{
			content.id = MetaUtility.getRandomString(ID_LENGTH);
			this._meta.push(content);

			let success = await U.wrap(save, this._meta).catch(onErr);
			if (U.isUdf(success))
			{
				this._meta.pop();
				return;
			}

			this._tagTracker.increment(content[TAG_KEY]);

			cb({success: true});
		}

		async deleteContent(contentId, params, cb, onErr)
		{
			let {content, index} = MetaUtility.searchId(this._meta, contentId);
			if (content)
			{
				this._meta.splice(index, 1);
				this._tagTracker.decrement(content[TAG_KEY]);

				save(this._meta, () => {
					cb({success: true});
				}, onErr);
			}
			else
			{
				onErr({notFound: true});
			}
		}

		async findContent(contentId, params, cb, onErr)
		{
			let {content} = MetaUtility.searchId(this._meta, contentId);
			if (content)
			{
				cb({content: content});
			}
			else
			{
				onErr({notFound: true});
			}
		}

		async updateContent(contentId, params, cb, onErr)
		{
			let {content, index} = MetaUtility.searchId(this._meta, contentId);
			if (content)
			{
				if (params.info[TAG_KEY])
				{
					this._tagTracker.decrement(content[TAG_KEY]);
					this._tagTracker.increment(params.info[TAG_KEY]);
				}

				delete params.info.id;
				this._meta[index] = U.extend(content, params.info);

				save(this._meta, () => {
					cb({success: true});
				}, onErr);
			}
			else
			{
				onErr({notFound: true});
			}
		}
	}

	async function load(cb, onErr)
	{
		let data = await getKeyWrapper("meta").catch(onErr);
		if (U.isUdf(data)) return;

		let serialized = data.meta;
		if (!serialized)
		{
			cb([]);
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
				onErr(null);
				return;
			}
		}

		cb(meta);
	}

	// throws {memmoryError}
	async function save(meta, cb, onErr)
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
				onErr({memoryError: true});
			}
			else
			{
				cb(true);
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
	return class {
		constructor(connector)
		{
			this._connector = connector;
			this._appCount = 0;
		}

		get crError()
		{
			return {connectionRequired: true};
		}

		async getContent(cb, onErr)
		{
			let appPromise = U.bindWrap(this._requestApp, this, "get-meta", null).catch(U.noop);
			let all = Promise.all([DataManager.instance, appPromise]);

			let result;
			try {
				result = await all;
			} catch (e) {
				onErr();
				return;
			}

			let final = { local: {meta: result[0].meta}, app: result[1]};
			cb(final);
		}

		async getTags(cb, onErr)
		{
			let result = await this._collectData("get-tags", null).catch(onErr);
			if (U.isUdf(result)) return;

			let localTags = result[0].tags;
			if (result[1])
			{
				let concat = localTags.concat(result[1].tags);
				let combinedTags = U.removeDuplicates(concat);
				cb(combinedTags);
			}
			else
			{
				cb(localTags);
			}
		}

		_collectData(type, message)
		{
			let appPromise = U.bindWrap(this._requestApp, this, type, message).catch(U.noop);
			let all = Promise.all([DataManager.instance, appPromise]);
			return all;
		}

		async addContent(content, cache, cb, onErr)
		{
			let message = { content: content,
							download: cache };
			this._requestApp("add-content", message, cb, () => {
				DataManager.instance.then((dm) => {
					dm.addContent(content, cb, onErr);
				}, onErr);
			});
		}

		findContent(contentId, cb, onErr)
		{
			this._handleContent("findContent", "find-content", contentId, null, cb, onErr);
		}

		deleteContent(contentId, cb, onErr)
		{
			this._handleContent("deleteContent", "remove-content", contentId, null, cb, onErr);
		}

		updateContent(contentId, updateInfo, cb, onErr)
		{
			this._handleContent("updateContent", "update-content", contentId, {info: updateInfo}, cb, onErr);
		}

		_handleContent(localFunction, type, contentId, params, cb, onErr)
		{
			if (fromApp(contentId))
			{
				this._requestApp(type, {id: contentId, params: params}, cb, 
								 onErr.bind(null, this.crError));
			}
			else
			{
				DataManager.instance.then((dm) => {
					dm[localFunction](contentId, params, cb, onErr);
				}, onErr);
			}
		}

		async _requestApp(type, message, cb, onErr)
		{
			let connected = await U.bindWrap(this._connector.connect, this._connector);
			if (!connected)
			{
				onErr();
				return;
			}

			console.log("connector:", this._connector);
			if (this._connector.appConnected)
			{
				let tag = U.makeTag(type, this._appCount);
				this._appCount += 1;

				let request = { type: type,
								tag: tag,
								message: message };

				this._connector.postMessage(request, tag, cb, onErr);
			}
			else
			{
				onErr();
			}
		}
	};

	function fromApp(id)
	{
		return id.substring(0, 4) === "app_";
	}
})();
