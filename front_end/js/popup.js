
injectCss(document.head, `css/popup-theme-${"light"}.css`);
injectCss(document.head, `css/popup-tint-${"yellow"}.css`);

(function(){

    const cl_hide = "noshow";
	const cl_autoComplete = [ "save-menu__auto-complete", 
							  "save-menu__auto-complete--theme" ];

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
							  tabIndex: 1, 
							  submitKeys: [COMMA_CODE] };
	const g_taggle = createTaggle(el_tagContainer, g_taggleOptions);

	let g_meta, 
		g_docUrl, 
		g_tabId;

	attachMaskEvents();
	attachButtonEvents();
	attachStyleEvents();

	(async () => {
		let response = await wrap(getPopupInfo).catch(noop);
		if (isUdf(response)) return;

		g_tabId = response.tabId;
		g_docUrl = response.docUrl;

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
					 date: new Date().getMinutes(),
					 srcUrl: srcUrl,
					 docUrl: g_docUrl };

		let msg = {request: "add-meta", meta: meta, cache: cache};

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
			else
			{
				console.warn("Could not handle response:", response);
			}
		});
	}

	function getPopupInfo(successCallback, errorCallback)
	{
		chrome.runtime.sendMessage({request: "get-popupInfo"}, (response) => {
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
		let input = taggle.getInput();

		input.maxLength = TAG_CHARCTER_LIMIT;

		input.addEventListener("focus", () => {
			el_tagContainer.dispatchEvent(new Event("focus"));
		});
		input.addEventListener("blur", () => {
			el_tagContainer.dispatchEvent(new Event("blur"));			
		});

		return taggle;
	}

	function createAutoComplete(tags)
	{
		let list = document.createElement("ul");
		addClasses(list, cl_autoComplete);
		el_tagContainer.appendChild(list);

		let input = g_taggle.getInput();
		let confirmEvent = new KeyboardEvent("keydown", {keyCode: COMMA_CODE});
		let confirmInput = () => { input.dispatchEvent(confirmEvent); };

		new Widgets.AutoComplete(input, list, tags, confirmInput);
	}

	function createSourceList(srcUrl, docUrl, scanInfo, isImage)
	{
		let setMeta = (li, data) => {
			g_meta = { srcUrl: data.srcUrl, 
					   category: data.category };
			el_title.value = data.title;
		}
		let manager = new Widgets.ListManager(el_sourceList, {onSelect: setMeta});

		if (isImage)
		{
			enableElement(el_saveBtn);

			let options = { title: "source clicked on",
							type: "image",
							showDimensions: true,
							data: {
								srcUrl: srcUrl,
								category: "image",
								title: ""
							}};
			manager.addSource(srcUrl, options);

			if (srcUrl === docUrl)
			{
				return;
			}
		}

		if (scanInfo.list && scanInfo.list.length)
		{
			enableElement(el_saveBtn);
			enableElement(el_sourceMenu);

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
			let options = { title: video.title,
							showDimensions: false, 
							download: false, 
							data: {
								srcUrl: video.url,
								category: "video",
								title: video.title
							}};
			manager.addSource(video.url, options);
		}
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
		el_saveBtn.addEventListener("click", () => {
			saveMeta(g_meta.srcUrl, g_meta.category, true);
		}, {once: true});

		el_bookmarkBtn.addEventListener("click", () => {
			saveMeta(g_docUrl, "web", false);
		}, {once: true});
	}

	function attachStyleEvents()
	{
		Widgets.styleOnFocus(el_title, el_title.parentElement, "focus");
		Widgets.styleOnFocus(el_tagContainer, el_tagContainer, "focus");

		el_title.addEventListener("focus", () => {
			el_title.placeholder = "";
		});
		el_title.addEventListener("blur", () => {
			el_title.placeholder = "enter title...";
		});
	}

	function enableElement(elm)
	{
		elm.classList.remove(cl_hide);
	}
}).call(this);