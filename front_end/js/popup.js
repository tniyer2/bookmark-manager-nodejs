
this.getTaggleInputFormatter = (function(){
	const RESERVED_KEYS = ['*', '!'];
	const getMessage = (character) => `'${character}' is a reserved character`;
	const DELAY = 5;
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

				this._alert = this._alerter.alert(getMessage(evt.key), DELAY);
			}
		});
	}

	return function(alerter) {
		let context = {_alerter: alerter};
		return Inner.bind(context);
	};
})();

(function(){

	const NO_SOURCE_MESSAGE = "Pick a source first.",
		  NO_SOURCE_ALERT_DELAY = 5,
		  g_taggleOptions = { placeholder: "enter tags...",
							  tabIndex: 0 };
    const cl_hide = "noshow",
    	  cl_scrollbar = "customScrollbar1";

	const el_sizer = document.getElementById("sizer");

	const el_saveMenu = document.getElementById("save-menu"),
		  el_title 		  = el_saveMenu.querySelector("#title"),
		  el_tagContainer = el_saveMenu.querySelector("#tag-container"),
		  el_saveBtn 	  = el_saveMenu.querySelector("#save-btn"),
		  el_bookmarkBtn  = el_saveMenu.querySelector("#bookmark-btn"),
		  el_sourceMenu = document.getElementById("source-menu");

	let g_alerter,
		g_noSourceAlert,
		g_taggle;

	let g_source,
		g_docUrl,
		g_popupId,
		g_tabId;

	return function() {
		U.injectThemeCss("light", ["scrollbar", "alerts", "taggle", "popup"]);

		g_alerter = createAlerter();
		g_taggleOptions.inputFormatter = getTaggleInputFormatter(g_alerter);
		g_taggle = MyTaggle.createTaggle(el_tagContainer, g_taggleOptions);

		attachMaskEvents();
		attachButtonEvents();
		attachStyleEvents();
		load();
	};

	async function load()
	{
		let response = await U.wrap(ApiUtility.makeRequest, {request: "get-popup-info"}).catch(U.noop);
		if (U.isUdf(response)) return;

		g_tabId = response.tabId;
		g_popupId = response.popupId;
		g_docUrl = response.docUrl;

		U.removeClass(el_bookmarkBtn, cl_hide);
		U.removeClass(el_saveMenu, cl_hide);
		MyTaggle.createAutoComplete(g_taggle, el_tagContainer.parentElement, response.tags);
		createSourceList(response.srcUrl, g_docUrl,
						 response.scanInfo, response.mediaType === "image");
	}

	function getRandomDate(days)
	{
		let rand = Math.random() * days;
		let offset = rand * 24 * 60 * 60 * 1000;
		return Date.now() - offset;
	}

	function saveMeta(srcUrl, category, cache)
	{
		let meta = { title: el_title.value.trim(),
					 tags: g_taggle.getTags().values,
					 category: category,
					 date: Date.now()/*getRandomDate(35)*/,
					 srcUrl: srcUrl };

		if (g_source)
		{
			meta.duration = g_source.duration;
		}

		let message = { request: "add-meta",
						meta: meta,
						popupId: g_popupId };

		ApiUtility.makeRequest(message, (response) => {
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

	function closePopup()
	{
		if (g_tabId)
		{
			let message = {to: "content.js", close: true};
			chrome.tabs.sendMessage(g_tabId, message);
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
				// manager.addSource(video.url, options);
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

			if (g_source)
			{
				saveMeta(g_source.url, g_source.category);
			}
			else
			{
				g_noSourceAlert = g_alerter.alert(NO_SOURCE_MESSAGE, NO_SOURCE_ALERT_DELAY);
				attachSave();
			}
		};
		let bookmark = () => {
			IconGrabber.getUrl(g_docUrl, (url) => {
				saveMeta(url, "bookmark");
			}, () => {
				let url = IconGrabber.getFaviconUrl(g_docUrl);
				saveMeta(url, "bookmark");
			});
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
})()();
