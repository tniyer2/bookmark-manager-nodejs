
(function(){

	this.AppConnector = class{
		constructor(appName)
		{
			this.APP_TIMEOUT = 1000;
			this.appName = appName;
		}

		async connect(successCallback, errorCallback)
		{
			if (!this.port)
			{
				this.port = await wrap(this._getPort.bind(this));

				if (!this.port)
				{
					successCallback(null);
					return;
				}
			}

			let connected = await wrap(this._getStatus.bind(this));
			if (connected)
			{
				// console.log("app status: connected");
				this.port.onDisconnect.addListener(() => {
					if (chrome.runtime.lastError)
					{
						console.warn(chrome.runtime.lastError.message);
					}
					this.port = null;
				});
				successCallback(this.port);
			}
			else
			{
				// console.log("app status: disconnected");
				successCallback(null);
			}
		}

		async getStatus(successCallback, errorCallback)
		{
			if (this.port)
			{
				_getStatus(successCallback, errorCallback);
			}
			else
			{
				successCallback(false);
			}
		}

		async _getPort(successCallback, errorCallback)
		{
			let timeoutId = setTimeout(() => {
				port.onDisconnect.removeListener(listener);
				successCallback(port);
			}, this.APP_TIMEOUT);

			let port = chrome.runtime.connectNative(this.appName);
			port.onDisconnect.addListener(listener);

			function listener()
			{
				if (chrome.runtime.lastError)
				{
					console.warn(chrome.runtime.lastError.message);
				}
				clearTimeout(timeoutId);
				port.onDisconnect.removeListener(listener);
				successCallback(null);
			}
		}

		async _getStatus(successCallback, errorCallback)
		{
			if (!this.port)
			{
				console.warn("this.port is", this.port);
				successCallback(false);
				return;
			}

			this.port.postMessage("status");
			this.port.onMessage.addListener(listener);

			function listener(response, port)
			{
				if (response.tag !== "status") return;

				port.onMessage.removeListener(listener);
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
	}
}).call(this);