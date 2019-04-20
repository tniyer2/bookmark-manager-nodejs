
(function(){

	injectThemeCss("light", ["popup", "taggle", "scrollbar", "alerts"]);

	// caching stops after this limit
	const VIDEO_DURATION_LIMIT = 120;
	const NO_SOURCE_MESSAGE = "Pick a source first.";
	const NO_SOURCE_ALERT_DELAY = 5;

	const RESERVED_KEYS = ['*', '!'];
	const RESERVED_KEYS_REGEX = RegExp(`[${RESERVED_KEYS.join('')}]`, 'g');
	const RESERVED_KEY_MESSAGE = (character) => `'${character}' is a reserved character`;
	const RESERVED_KEY_ALERT_DELAY = 5;

    const cl_hide = "noshow";
    const cl_scrollbar = "customScrollbar1";

	const el_sizer = document.getElementById("sizer");
	const el_saveMenu = document.getElementById("save-menu");
	const el_title 		  = el_saveMenu.querySelector("#title");
	const el_tagContainer = el_saveMenu.querySelector("#tag-container");
	const el_saveBtn 	  = el_saveMenu.querySelector("#save-btn");
	const el_bookmarkBtn  = el_saveMenu.querySelector("#bookmark-btn");
	const el_sourceMenu = document.getElementById("source-menu");

	const g_taggleOptions = { placeholder: "enter tags...",
							  tabIndex: 0 };
	let g_taggle = createTaggle(el_tagContainer, g_taggleOptions);

	let g_meta, g_popupId, g_tabId;
	let g_cache = false;
	let g_noSourceAlert;

	attachMaskEvents();
	attachButtonEvents();
	attachStyleEvents();
	let alerter = createAlerter();

	(async () => {
		let response = await wrap(getPopupInfo).catch(noop);
		if (isUdf(response)) return;

		g_tabId = response.tabId;
		g_popupId = response.popupId;

		enableElement(el_bookmarkBtn);
		enableElement(el_saveMenu);
		MyTaggle.createAutoComplete(g_taggle, el_tagContainer.parentElement, response.tags);
		createSourceList(response.srcUrl, response.docUrl,
						 response.scanInfo, response.mediaType === "image");
	})();

	function getRandomDate(days)
	{
		let rand = Math.random() * days;
		let offset = rand * 24 * 60 * 60 * 1000;
		return Date.now() - offset;
	}

	function saveMeta(srcUrl, category, cache)
	{
		let meta = { title: el_title.value,
					 tags: g_taggle.getTags().values,
					 category: category,
					 date: Date.now()/*getRandomDate(35)*/,
					 srcUrl: srcUrl };

		let msg = { request: "add-meta",
					meta: meta,
					cache: cache,
					popupId: g_popupId };

		chrome.runtime.sendMessage(msg, (response) => {

			if (chrome.runtime.lastError)
			{
				console.warn(chrome.runtime.lastError.message);
				return;
			}

			if (response.success)
			{
				closePopup();
			}
			else if (response.memoryError)
			{
				closePopup();
			}
			else
			{
				console.warn("Could not handle response:", response);
				closePopup();
			}
		});
	}

	function getPopupInfo(successCallback, errorCallback)
	{
		chrome.runtime.sendMessage({request: "get-popup-info"}, (response) => {
			if (chrome.runtime.lastError)
			{
				console.warn(chrome.runtime.lastError.message);
				errorCallback(null);
			}
			else
			{
				successCallback(response);
			}
		});
	}

	function closePopup()
	{
		let message = {to: "content.js", close: true};
		chrome.tabs.sendMessage(g_tabId, message);
	}

	function createTaggle(container, options)
	{
		options.inputFormatter = (input) => {
			let prevAlert;

			input.addEventListener("input", () => {
				input.value = input.value.replace(RESERVED_KEYS_REGEX, '');
			});
			input.addEventListener("keydown", (evt) => {
				if (RESERVED_KEYS.includes(evt.key))
				{
					if (prevAlert)
					{
						prevAlert.removeImmediately();
					}

					prevAlert = alerter.alert(RESERVED_KEY_MESSAGE(evt.key), RESERVED_KEY_ALERT_DELAY);
				}
			});
		};
		taggle = MyTaggle.createTaggle(container, options);
		return taggle;
	}

	function createSourceList(srcUrl, docUrl, scanInfo, isImage)
	{
		let setMeta = (li, data) => {

			g_meta = { srcUrl: data.srcUrl,
					   category: data.category };

			if (!el_title.value)
			{
				el_title.value = data.title;
			}

			if (g_noSourceAlert)
			{
				g_noSourceAlert.remove();
			}

			if (data.category === "image")
			{
				g_cache = true;
			}
			else if (data.category === "video")
			{
				if (data.sourceMeta && 
					data.sourceMeta.duration <= VIDEO_DURATION_LIMIT)
				{
					g_cache = true;
				}
				else
				{
					g_cache = false;
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
			enableElement(el_saveBtn);
			// enableElement(el_sourceMenu);

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
			enableElement(el_saveBtn);
			enableElement(el_sourceMenu);
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
				// manager.addSource(video.url, options);
			});
		}
		else if (scanInfo.single)
		{
			enableElement(el_saveBtn);

			let video = scanInfo.single;
			setMeta(null, { srcUrl: video.url,
							category: "youtube",
							title: video.title });
		}
	}

	function createAlerter() 
	{
		let a =  new Widgets.AwesomeAlerter(document.body, 
				{ BEMBlock: "alerts", 
	  	  		  insertAtTop: false });
		a.list.addEventListener("click", (evt) => {
			evt.stopPropagation();
		});
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

	function attachButtonEvents()
	{
		let attachSave = () => {
			el_saveBtn.addEventListener("click", save, {once: true});
		};

		let save = () => {
			if (g_noSourceAlert)
			{
				g_noSourceAlert.removeImmediately();
			}

			if (g_meta)
			{
				saveMeta(g_meta.srcUrl, g_meta.category, g_cache);
			}
			else
			{
				g_noSourceAlert = alerter.alert(NO_SOURCE_MESSAGE, NO_SOURCE_ALERT_DELAY);
				attachSave();
			}
		};
		let bookmark = () => {
			saveMeta("docUrl", "bookmark", false);
		};

		attachSave();
		el_bookmarkBtn.addEventListener("click", bookmark, {once: true});
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
				enableElement(el_sizer);
			}
			else
			{
				disableElement(el_sizer);
			}
		};
		onResize();
		window.addEventListener("resize", onResize);
	}

	function attachStyleEvents()
	{
		Widgets.styleOnFocus(el_title.parentElement, "focus", {target: el_title});
		Widgets.styleOnFocus(el_tagContainer, "focus", {target: el_tagContainer});

		el_title.addEventListener("focus", () => {
			el_title.placeholder = "";
		});
		el_title.addEventListener("blur", () => {
			el_title.placeholder = "enter title...";
		});
		let taggleInput = g_taggle.getInput();
		Widgets.onKeyDown(el_title, "Enter", (evt) => {
			taggleInput.focus();
		});

		fgs = el_saveMenu.querySelector("#focus-guard-start");
		fge = el_saveMenu.querySelector("#focus-guard-end");

		fgs.addEventListener("focus", () => {
			taggleInput.focus();
		});
		fge.addEventListener("focus", () => {
			el_title.focus();
		});
		el_title.addEventListener("focus", () => {fgs.tabIndex = 0;});
		el_title.addEventListener("blur", () => {fgs.tabIndex = -1;});
	}

	function enableElement(elm)
	{
		if (elm.classList.contains(cl_hide))
		{
			elm.classList.remove(cl_hide);
		}
	}

	function disableElement(elm)
	{
		if (!elm.classList.contains(cl_hide))
		{
			elm.classList.add(cl_hide);
		}
	}
}).call(this);
