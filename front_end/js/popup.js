
(function(){

	const THEME = "light"
	injectCss(document.head, `css/popup-theme-${THEME}.css`);
	injectCss(document.head, `css/alerts-theme-${THEME}.css`);

	// caching stops after this limit
	const VIDEO_DURATION_LIMIT = 120;

    const cl_hide = "noshow";

	const el_sizer = document.getElementById("sizer");
	const el_saveMenu = document.getElementById("save-menu");
	const el_title 		  = el_saveMenu.querySelector("#title");
	const el_tagContainer = el_saveMenu.querySelector("#tag-container");
	const el_saveBtn 	  = el_saveMenu.querySelector("#save-btn");
	const el_bookmarkBtn  = el_saveMenu.querySelector("#bookmark-btn");
	const el_sourceMenu = document.getElementById("source-menu");
	const el_sourceList = el_sourceMenu.querySelector("ul");

	const TAG_CHARCTER_LIMIT = 30;
	const COMMA_CODE = 188;
	const g_taggleOptions = { placeholder: "enter tags...",
							  tabIndex: 0,
							  submitKeys: [COMMA_CODE] };
	const g_taggle = createTaggle(el_tagContainer, g_taggleOptions);

	let g_meta,
		g_popupId,
		g_tabId;
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
		createAutoComplete(response.tags);
		createSourceList(response.srcUrl, response.docUrl,
						 response.scanInfo, response.mediaType === "image");
	})();

	function saveMeta(srcUrl, category, cache)
	{
		let meta = { title: el_title.value,
					 tags: g_taggle.getTags().values,
					 category: category,
					 date: Date.now(),
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
		let taggle = new Taggle(container, options);
		let taggleInput = taggle.getInput();

		taggleInput.maxLength = TAG_CHARCTER_LIMIT;

		taggleInput.addEventListener("focus", () => {
			el_tagContainer.dispatchEvent(new Event("focus"));
		});
		taggleInput.addEventListener("blur", () => {
			el_tagContainer.dispatchEvent(new Event("blur"));
		});

		taggle.setOptions({tagFormatter: (li) => {
			li.addEventListener("click", (evt) => {
				evt.stopPropagation();

				let text = li.querySelector("span").innerText;
				taggle.remove(text);

				if (!taggle.getTags().values.length)
				{
					taggleInput.focus();
				}
			});
		}, onTagAdd: (evt, text) => {
			el_tagContainer.scrollTop = el_tagContainer.scrollHeight;
		}});

		return taggle;
	}

	function createAutoComplete(values)
	{
		let taggleInput = g_taggle.getInput();
		let confirmEvent = new KeyboardEvent("keydown", {keyCode: COMMA_CODE});
		let confirmInput = () => { taggleInput.dispatchEvent(confirmEvent); };

		new Widgets.AutoComplete(taggleInput, el_tagContainer.parentElement, 
								 { BEMBlock: "save-menu",
								   values: values, 
								   onConfirm: confirmInput });
	}

	function createSourceList(srcUrl, docUrl, scanInfo, isImage)
	{
		let setMeta = (li, data) => {

			g_meta = { srcUrl: data.srcUrl,
					   category: data.category };
			el_title.value = data.title;
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
		let manager = new Widgets.ListManager(el_sourceList, 
											  { BEMBlock: "source-menu",
											    selectFirst: false,
												onSelect: setMeta });
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
			});
		}
		else if (scanInfo.single)
		{
			enableElement(el_saveBtn);

			let video = scanInfo.single;
			setMeta(null, { srcUrl: video.url,
							category: "video",
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
		let stopBubble = (evt) => { evt.stopPropagation(); };
		el_saveMenu.addEventListener("click", stopBubble);
		el_sourceMenu.addEventListener("click", stopBubble);
		document.documentElement.addEventListener("click", closePopup);
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
				g_noSourceAlert = alerter.alert("pick a source first", 3);
				attachSave();
			}
		};
		let bookmark = () => {
			saveMeta("docUrl", "web", false);
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
		Widgets.styleOnFocus(el_title, el_title.parentElement, "focus");
		Widgets.styleOnFocus(el_tagContainer, el_tagContainer, "focus");

		el_title.addEventListener("focus", () => {
			el_title.placeholder = "";
			el_title.style.fontSize = 16 + "px";
		});
		el_title.addEventListener("blur", () => {
			el_title.placeholder = "enter title...";
			if (!el_title.value)
			{
				el_title.style.fontSize = null;
			}
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
