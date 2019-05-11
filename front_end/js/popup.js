
this.getTaggleInputFormatter = (function(){
	const RESERVED_KEYS = ['*', '!'];
	const getMessage = (character) => `'${character}' is a reserved character`;
	const REGEX = RegExp(`[${RESERVED_KEYS.join("")}]`, 'g');

	function Inner(input)
	{
		input.addEventListener("input", () => {
			input.value = input.value.replace(REGEX, "");
		});
		input.addEventListener("keydown", (evt) => {
			if (RESERVED_KEYS.includes(evt.key))
			{
				if (this._alert)
				{
					this._alert.removeImmediately();
				}

				this._alert = this._alerter.alert(getMessage(evt.key));
			}
		});
	}

	return function(alerter) {
		let context = {_alerter: alerter};
		return Inner.bind(context);
	};
})();

(function(){

	const NO_LOAD_MESSAGE = "Popup couldn't load. Try refreshing the page.",
		  NO_SOURCE_MESSAGE = "Pick a source first.",
		  NO_URL_MESSAGE = "Enter a url in the url field.",
		  INVALID_URL_MESSAGE = "Url entered is not a valid url.",
		  MEMORY_ERROR_MESSAGE = "No more data left in chrome storage. Download the desktop app for extra storage.";

    const cl_hide = "noshow",
    	  cl_scrollbar = "customScrollbar1";

	const el_errorMessage = document.getElementById("error-message");

	const el_sizer = document.getElementById("sizer");

	const el_saveMenu = document.getElementById("save-menu"),
		  el_url = el_saveMenu.querySelector("#url-input"),
		  el_title = el_saveMenu.querySelector("#title-input"),
		  el_tagContainer = el_saveMenu.querySelector("#tag-container"),
		  el_saveBtn = el_saveMenu.querySelector("#save-btn"),
		  el_bookmarkBtn = el_saveMenu.querySelector("#bookmark-btn"),
		  el_fgStart = el_saveMenu.querySelector("#focus-guard-start"),
		  el_fgEnd = el_saveMenu.querySelector("#focus-guard-end");

	const el_sourceMenu = document.getElementById("source-menu");

	const TAGGLE_OPTIONS = { placeholder: "tags...",
						 tabIndex: 0 },
		  ALERTER_OPTIONS = { duration: 5 };

	let g_alerter,
		g_noSourceAlert,
		g_noUrlAlert,
		g_invalidUrlAlert,
		g_taggle;

	let g_source,
		g_docUrl,
		g_popupId,
		g_tabId,
		g_manual;

	return function() {
		U.injectThemeCss(document.head, ["scrollbar", "alerts", "taggle", "popup"], "light");

		g_alerter = createAlerter(ALERTER_OPTIONS);
		document.body.appendChild(g_alerter.alertList);

		TAGGLE_OPTIONS.alerter = g_alerter;
		TAGGLE_OPTIONS.inputFormatter = getTaggleInputFormatter(g_alerter);
		g_taggle = MyTaggle.createTaggle(el_tagContainer, TAGGLE_OPTIONS);

		attachMaskEvents();

		parseQueryString();
		if (g_manual)
		{
			U.removeClass(el_url.parentElement, cl_hide);
			load2();
			attachClick(el_saveBtn, getManualSave((url) => {
				requestSaveManual({ srcUrl: url, 
									category: "image" });
			}));
			attachClick(el_bookmarkBtn, getManualSave((url) => {
				requestSaveManual({ docUrl: url, 
									category: "bookmark" });
			}));
		}
		else
		{
			load();
			attachClick(el_saveBtn, save);
			attachClick(el_bookmarkBtn, () => {
				requestSave({category: "bookmark"});
			});
		}
		attachStyleEvents();
	};

	function parseQueryString()
	{
		let params = new URLSearchParams(document.location.search.substring(1));
		g_tabId = Number(params.get("tabId"));
		g_popupId = params.get("popupId");
		g_manual = params.has("manual");
	}

	async function load()
	{
		ApiUtility.makeRequest({request: "get-popup-info", popupId: g_popupId, to: "background.js"})
		.then((response) => {
			g_docUrl = response.docUrl;

			U.removeClass(el_bookmarkBtn, cl_hide);
			U.removeClass(el_saveMenu, cl_hide);
			MyTaggle.createAutoComplete(g_taggle, el_tagContainer.parentElement, response.tags);
			createSourceList(response.srcUrl, g_docUrl,
							 response.scanInfo, response.mediaType === "image");
		}).catch((err) => {
			console.log("error loading popup:", err);
			onNoLoad();
		});
	}

	async function load2()
	{
		ApiUtility.makeRequest({request: "get-tags", to: "background.js"})
		.then((tags) => {
			U.removeClass(el_saveBtn, cl_hide);
			U.removeClass(el_bookmarkBtn, cl_hide);
			U.removeClass(el_saveMenu, cl_hide);
			MyTaggle.createAutoComplete(g_taggle, el_tagContainer.parentElement, tags);
		}).catch((err) => {
			console.log("error loading popup:", err);
			onNoLoad();
		});
	}

	function genContentInfo()
	{
		return { title: el_title.value.trim(),
				 tags: g_taggle.getTags().values,
				 date: Date.now() };
	}

	function requestSave(source)
	{
		let info = U.extend(genContentInfo(), source);

		if (g_source)
		{
			info.duration = g_source.duration;
		}

		let message = { request: "add-content",
						info: info,
						popupId: g_popupId,
						to: "background.js" };

		requestSaveCommon(message);
	}

	function requestSaveManual(source)
	{
		let info = U.extend(genContentInfo(), source);

		let message = { request: "add-content-manually",
						info: info,
						to: "background.js" };

		requestSaveCommon(message);
	}

	function requestSaveCommon(message)
	{
		ApiUtility.makeRequest(message).then((response) => {
			if (response.success)
			{
				closePopup();
			}
			else if (response.memoryError)
			{
				g_alerter.alert(MEMORY_ERROR_MESSAGE);
			}
			else
			{
				console.warn("could not handle response:", response);
				closePopup();
			}
		}).catch((err) => {
			console.warn("error saving content:", err);
			closePopup();
		});
	}

	function onNoLoad()
	{
		let textNode = document.createTextNode(NO_LOAD_MESSAGE);
		el_errorMessage.appendChild(textNode);
		U.removeClass(el_errorMessage, cl_hide);
	}

	function closePopup()
	{
		if (g_manual)
		{
			window.parent.PopupManager.close();
		}
		else
		{
			if (g_tabId)
			{
				let message = {to: "content.js", close: true};
				chrome.tabs.sendMessage(g_tabId, message);
			}
		}
	}

	function createSourceList(srcUrl, docUrl, scanInfo, isImage)
	{
		let setMeta = (li, data) => {

			g_source = { url: data.srcUrl,
					   	 category: data.category };

			if (!el_title.value)
			{
				el_title.value = data.title;
			}

			if (g_noSourceAlert)
			{
				g_noSourceAlert.remove();
			}

			if (data.category === "video")
			{
				if (data.sourceMeta && data.sourceMeta.duration)
				{
					g_source.duration = data.sourceMeta.duration;
				}
			}
		};
		let manager = new Widgets.ListManager(el_sourceMenu,
											  { BEMBlock: "source-menu",
											    selectFirst: false,
												onSelect: setMeta });
		manager.el_list.classList.add(cl_scrollbar);

		if (isImage)
		{
			U.removeClass(el_saveBtn, cl_hide);
			// U.removeClass(el_sourceMenu, cl_hide);

			let options = { title: "source clicked on",
							type: "image",
							showDimensions: true,
							data: {
								srcUrl: "srcUrl",
								category: "image",
								title: ""
							}};
			manager.addSource(srcUrl, options);
			setMeta(null, options.data);

			if (srcUrl === docUrl)
			{
				return;
			}
		}

		if (scanInfo.list && scanInfo.list.length)
		{
			U.removeClass(el_saveBtn, cl_hide);
			U.removeClass(el_sourceMenu, cl_hide);
			attachResizeEvents();

			scanInfo.list.forEach((video) => {
				let options = { title: video.title,
								type: "video",
								showDimensions: true,
								data: {
									srcUrl: video.url,
									category: "video",
									title: video.title
								}};
				manager.addSource(video.url, options);
			});
		}
		else if (scanInfo.single)
		{
			U.removeClass(el_saveBtn, cl_hide);

			let video = scanInfo.single;
			setMeta(null, { srcUrl: video.url,
							category: "youtube",
							title: video.title });
		}
	}

	function createAlerter()
	{
		let a = new Widgets.AwesomeAlerter();
		U.preventBubble(a.alertList, ["click", "mousedown", "mouseup"]);
		return a;
	}

	function attachMaskEvents()
	{
		let eventName = "mousedown";
		let stopBubble = (evt) => { evt.stopPropagation(); };
		el_saveMenu.addEventListener(eventName, stopBubble);
		el_sourceMenu.addEventListener(eventName, stopBubble);
		document.documentElement.addEventListener(eventName, closePopup);
	}

	function attachClick(elm, cb)
	{
		function inner()
		{
			elm.addEventListener("click", (evt) => {
				if (cb(evt) === true)
				{
					inner();
				}
			}, {once: true});
		}
		inner();
	}

	function save()
	{
		if (g_noSourceAlert)
		{
			g_noSourceAlert.removeImmediately();
		}

		if (g_source)
		{
			requestSave({ srcUrl: g_source.url, 
						  category: g_source.category });
		}
		else
		{
			g_noSourceAlert = g_alerter.alert(NO_SOURCE_MESSAGE);
			return true;
		}
	}

	function getManualSave(cb)
	{
		return () => {
			if (g_noUrlAlert) g_noUrlAlert.removeImmediately();
			if (g_invalidUrlAlert) g_invalidUrlAlert.removeImmediately();

			let urlValue = el_url.value.trim();
			if (!urlValue)
			{
				g_noUrlAlert = g_alerter.alert(NO_URL_MESSAGE);
				return true;
			}

			let url;
			try {
				url = new URL(urlValue);
			} catch (e) {
				g_invalidUrlAlert = g_alerter.alert(INVALID_URL_MESSAGE);
				return true;
			}

			return cb(url);
		};
	}

	function attachResizeEvents()
	{
		let onResize = () => {
			let b1 = el_saveMenu.getBoundingClientRect();
			let b2 = el_sourceMenu.getBoundingClientRect();

			let hdiff = Math.abs(b1.height - b2.height) / 2;
			let tdiff = Math.abs(b1.top - b2.top);

			if (hdiff === tdiff)
			{
				U.removeClass(el_sizer, cl_hide);
			}
			else
			{
				U.removeClass(el_sizer, cl_hide);
			}
		};
		onResize();
		window.addEventListener("resize", onResize);
	}

	function attachStyleEvents()
	{
		Widgets.styleOnFocus(el_url.parentElement, "focus", {target: el_url});
		Widgets.styleOnFocus(el_title.parentElement, "focus", {target: el_title});
		Widgets.styleOnFocus(el_tagContainer, "focus", {target: el_tagContainer});
	}
})()();
