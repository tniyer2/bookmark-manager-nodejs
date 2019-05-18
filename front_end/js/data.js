
this.AppConnector = (function(){
	return class {
		constructor(appName)
		{
			this._appName = appName;
		}

		postMessage(message, cb, onErr)
		{
			if (typeof message !== "object" || message.tag === "disconnected")
			{
				console.warn("not a valid message:", message);
				onErr(false);
				return;
			}

			chrome.runtime.sendNativeMessage(this._appName, message, (response) => {
				if (chrome.runtime.lastError)
				{
					console.warn(chrome.runtime.lastError.message);
					onErr(false);
				}
				else
				{
					if (response.tag === "disconnected")
					{
						onErr(true);
					}
					else
					{
						cb(response.message);
					}
				}
			});
		}

		canAccessApi()
		{
			return Boolean(chrome.runtime.sendNativeMessage);
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
					onErr({connectionRequired: true});
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

			let tag = U.makeTag(type, this._appCount);
			this._appCount += 1;

			let request = { type: type,
							tag: tag,
							message: message };

			this._connector.postMessage(request, cb, onErr);
		}
	};

	function fromApp(id)
	{
		return id.substring(0, 4) === "app_";
	}
})();
