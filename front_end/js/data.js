
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

		canAccessApi()
		{
			return Boolean(chrome.runtime.connectNative);
		}
	};
})();

this.DataManager = new (function(){
	const TAG_KEY = "tags";
	const ID_LENGTH = 40;

	let instance;
	let self = this;

	// resolves data, rejects undefined
	this.getKeyWrapper = function(keys) {
		return new Promise((resolve, reject) => {
			chrome.storage.local.get(keys, (data) => {
				if (chrome.runtime.lastError)
				{
					console.warn(chrome.runtime.lastError.message);
					reject();
				}
				else
				{
					resolve(data);
				}
			});
		});
	};

	// resolves undefined, rejects {memoryError: true}
	this.setKeyWrapper = function(data) {
		return new Promise((resolve, reject) => {
			chrome.storage.local.set(data, () => {
				if (chrome.runtime.lastError)
				{
					console.warn(chrome.runtime.lastError.message);
					reject({memoryError: true});
				}
				else
				{
					 resolve();
				}
			});
		});
	};

	Object.defineProperty(this, "instance", { get: () => {
		return new Promise((resolve, reject) => {
			if (instance)
			{
				resolve(instance);
			}
			else
			{
				U.wrap(load).then((meta) => {
					instance = new Inner(meta);
					resolve(instance);
				}).catch(reject);
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

		get _successResponse()
		{
			return {success: true};
		}

		get _notFoundError()
		{
			return {notFound: true};
		}

		addContent(content, cb, onErr)
		{
			content.id = MetaUtility.getRandomString(ID_LENGTH);
			this._meta.push(content);

			U.wrap(save, this._meta).then(() => {
				this._tagTracker.increment(content[TAG_KEY]);
				cb(this._successResponse);
			}).catch((err) => {
				this._meta.pop();
				onErr(err);
			});
		}

		deleteContent(contentId, params, cb, onErr)
		{
			let {content, index} = MetaUtility.searchId(this._meta, contentId);
			if (content)
			{
				this._meta.splice(index, 1);

				U.wrap(save, this._meta).then(() => {
					this._tagTracker.decrement(content[TAG_KEY]);
					cb(this._successResponse);
				}).catch((err) => {
					this._meta.splice(index, 0, content);
					onErr(err);
				});
			}
			else
			{
				onErr(this._notFoundError);
			}
		}

		findContent(contentId, params, cb, onErr)
		{
			let {content} = MetaUtility.searchId(this._meta, contentId);
			if (content)
			{
				cb({content: content});
			}
			else
			{
				onErr(this._notFoundError);
			}
		}

		// @todo find a way to undo update if save fails.
		updateContent(contentId, params, cb, onErr)
		{
			let {content, index} = MetaUtility.searchId(this._meta, contentId);
			if (content)
			{
				delete params.info.id;

				this._meta[index] = U.extend(content, params.info);

				U.wrap(save, this._meta).then(() => {
					if (params.info[TAG_KEY])
					{
						this._tagTracker.decrement(content[TAG_KEY]);
						this._tagTracker.increment(params.info[TAG_KEY]);
					}
					cb(this._successResponse);
				}).catch((err) => {
					this._meta[index] = content;
					onErr(err);
				});
			}
			else
			{
				onErr(this._notFoundError);
			}
		}
	}

	async function load(cb, onErr)
	{
		let data = await self.getKeyWrapper("meta").catch(onErr);
		if (U.isUdf(data)) return;

		let json = data.meta;
		if (!json)
		{
			cb([]);
			return;
		}

		let meta;
		try {
			meta = json.split("\n").filter(Boolean).map(s => JSON.parse(s));
		} catch (e) {
			console.warn(e);
			onErr();
			return;
		}
		cb(meta);
	}

	function save(meta, cb, onErr)
	{
		let serialized = meta.map(content => JSON.stringify(content)).join("\n");
		self.setKeyWrapper({meta: serialized}).then(cb, onErr);
	}
})();

this.RequestManager = (function(){
	const DEFAULTS = { enableNativeMessaging: false };

	return class {
		constructor(connector, options)
		{
			this._options = U.extend(DEFAULTS, options);

			this._connector = connector;
			this._appCount = 0;
		}

		get crError()
		{
			return {connectionRequired: true};
		}

		get prError()
		{
			return {permissionRequired: true};
		}

		setOptions(options)
		{
			this._options = U.extend(this._options, options);
		}

		getContent(cb, onErr)
		{
			this._collectData("get-meta", null).then((results) => {
				let [dm, app] = results;

				let final = { local: { meta: dm.meta }, app: app };
				cb(final);
			}).catch(onErr);
		}

		getTags(cb, onErr)
		{
			this._collectData("get-tags", null).then((results) => {
				let [dm, app] = results;

				if (app)
				{
					let concat = dm.tags.concat(app.tags);
					let combined = U.removeDuplicates(concat);
					cb(combined);
				}
				else
				{
					cb(dm.tags);
				}
			}).catch(onErr);
		}

		_collectData(type, message)
		{
			let appPromise = U.bindWrap(this._requestApp, this, type, message).catch(U.noop);
			return Promise.all([DataManager.instance, appPromise]);
		}

		addContent(content, cache, cb, onErr)
		{
			if (this._options.enableNativeMessaging)
			{
				let message = { content: content,
								download: cache };
				U.bindWrap(this._requestApp, this, "add-content", message)
				.then(cb)
				.catch(addLocal);
			}
			else
			{
				addLocal();
			}

			function addLocal()
			{
				DataManager.instance.then((dm) => {
					dm.addContent(content, cb, onErr);
				}).catch(onErr);
			}
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
				if (!this._options.enableNativeMessaging || !this._connector.canAccessApi())
				{
					onErr(this.prError);
					return;
				}

				U.bindWrap(this._requestApp, this, type, {id: contentId, params: params})
				.then(cb)
				.catch(() => {
					onErr(this.crError);
				});
			}
			else
			{
				DataManager.instance.then((dm) => {
					dm[localFunction](contentId, params, cb, onErr);
				}).catch(onErr);
			}
		}

		async _requestApp(type, message, cb, onErr)
		{
			if (!this._options.enableNativeMessaging || !this._connector.canAccessApi())
			{
				onErr(this.prError);
				return;
			}
			
			let connected = await U.bindWrap(this._connector.connect, this._connector).catch(U.noop);
			if (!connected || !this._connector.appConnected)
			{
				onErr();
				return;
			}

			let tag = U.makeTag(type, this._appCount);
			this._appCount += 1;

			let request = { type: type,
							tag: tag,
							message: message };

			this._connector.postMessage(request, tag, cb, onErr);
		}
	};

	function fromApp(id)
	{
		return id.substring(0, 4) === "app_";
	}
})();
