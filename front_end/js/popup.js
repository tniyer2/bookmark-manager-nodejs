
injectCss(document.head, `css/popup-theme-${"light"}.css`);
injectCss(document.head, `css/popup-tint-${"yellow"}.css`);

(function(){

	let COMMA_CODE = 188;
    let TAB_CODE = 9;

	const cl_activeSource = "active";

	const el_saveMenu = document.getElementById("save-menu");
	const el_title 		  = el_saveMenu.querySelector("#title");
	const el_tagContainer = el_saveMenu.querySelector("#tag-container");
	const el_saveBtn 	  = el_saveMenu.querySelector("#save-btn");
	const el_bookmarkBtn  = el_saveMenu.querySelector("#bookmark-btn");
	const el_sourceMenu = document.getElementById("source-menu");
	const el_sourceList = el_sourceMenu.querySelector("ul");

	const TAG_CHAR_LIMIT = 30;
	const stopBubble = (evt) => { evt.stopPropagation() };
	const g_taggleOptions = { placeholder: "enter tags...",
							  tabIndex: 1, 
							  submitKeys: [COMMA_CODE] };
	const g_taggle = new Taggle(el_tagContainer, g_taggleOptions);

	let g_meta, 
		g_docUrl, 
		g_tabId;

	attachMaskEvents();
	attachButtonEvents();
	attachStyleEvents();

	initTaggleInput(g_taggle.getInput());
	createAutoComplete();

	(async () => {
		let response = await wrap(getPopupInfo);

		g_docUrl = response.docUrl;
		g_tabId = response.tabId;
		enableElement(el_bookmarkBtn);
		enableElement(el_saveMenu);

		let sourceList = new SourceList(el_sourceList);
		let mediaTypeIsImage = response.mediaType === "image";

		if (mediaTypeIsImage)
		{
			enableElement(el_saveBtn);

			let options = { title: "source clicked on",
							type: "image",
							showDimensions: true };
			options = extendOptions(options, response.srcUrl, "image", "");
			sourceList.addSourceElement(response.srcUrl, options);

			if (response.srcUrl === response.docUrl)
			{
				return;
			}
		}

		if (response.scanInfo.list && response.scanInfo.list.length)
		{
			enableElement(el_saveBtn);
			enableElement(el_sourceMenu);

			for (let i = 0, l = response.scanInfo.list.length; i < l; i+=1)
			{
				let video = response.scanInfo.list[i];
				let options = { title: video.title,
								type: "video", 
								showDimensions: true };
				options = extendOptions(options, video.url, "video", video.title);
				sourceList.addSourceElement(video.url, options);
			}
		}
		else if (response.scanInfo.single)
		{
			enableElement(el_saveBtn);

			let video = response.scanInfo.single;
			let options = { title: video.title,
							showDimensions: false, 
							download: false };
			options = extendOptions(options, video.url, "video", video.title);
			sourceList.addSourceElement(video.url, options);
		}
	})();

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

	function closePopup()
	{
		chrome.tabs.sendMessage(g_tabId, {to: "content.js", close: true});
	}

	function initTaggleInput(input)
	{
		input.maxLength = TAG_CHAR_LIMIT;

		input.addEventListener("focus", () => {
			el_tagContainer.dispatchEvent(new Event("focus"));
		});
		input.addEventListener("blur", () => {
			el_tagContainer.dispatchEvent(new Event("blur"));			
		});
	}

	function createAutoComplete()
	{
		let testValues = [ "rimiru", 
						   "slime", 
						   "gobiru", 
						   "goblin", 
						   "gobta", 
						   "rigird" ];
		let list = document.createElement("ul");
		list.classList.add("save-menu__autoc-list");
		list.classList.add("noshow");
		el_tagContainer.appendChild(list);

		let input = g_taggle.getInput();
		let confirmEvent = new KeyboardEvent("keydown", {keyCode: COMMA_CODE});
		let confirmInput = () => { input.dispatchEvent(confirmEvent); }; 

		let autoc = new autoComplete(input, list, testValues, confirmInput);
	}

	function extendOptions(options, srcUrl, category, title)
	{
		options.onSelect = (li) => {
			li.classList.add(cl_activeSource);
			setState(srcUrl, category, title);
		};
		options.onDeselect = (li) => {
			li.classList.remove(cl_activeSource);
		};

		return options;
	}

	function setState(srcUrl, category, title)
	{
		g_meta = { srcUrl: srcUrl, 
				   category: category };
		el_title.value = title;
	}

	function attachMaskEvents()
	{
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
		styleOnFocus(el_title, el_title.parentElement, "focus");
		styleOnFocus(el_tagContainer, el_tagContainer, "focus");

		el_title.addEventListener("focus", () => {
			el_title.placeholder = "";
		});
		el_title.addEventListener("blur", () => {
			el_title.placeholder = "enter title...";
		});
	}

	function enableElement(elm)
	{
		elm.classList.remove("noshow");
	}
}).call(this);