
injectCss(document.head, `css/popup-${"light"}.css`);

(function(){

	const el_mask = document.getElementById("mask");

	const el_saveMenu = document.getElementById("save-menu");
	const el_title 		 = el_saveMenu.querySelector("#title");
	const el_tagContainer 	 = el_saveMenu.querySelector("#tag-container");
	const el_saveBtn 	 = el_saveMenu.querySelector("#save-btn");
	const el_bookmarkBtn = el_saveMenu.querySelector("#bookmark-btn");

	const el_sourceMenu = document.getElementById("source-menu");
	const el_sourceList = el_sourceMenu.querySelector("ul");

	const g_dispatchFocus = () => { el_tagContainer.dispatchEvent(new Event("focus")); };
	const g_dispatchBlur  = () => { el_tagContainer.dispatchEvent(new Event("blur")); };

	const g_taggleOptions = { placeholder: "enter tags...",  
						   	  focusInputOnContainerClick: true,
						   	  onFocusInput: g_dispatchFocus, 
						   	  onBlurInput: g_dispatchBlur };

	const g_taggle = new Taggle(el_tagContainer, g_taggleOptions);

	let g_meta;
	let g_docUrl;
	let g_tabId;
	let glb_selectedList;

	chrome.runtime.sendMessage({request: "get-popupInfo"}, (response) => {

		if (chrome.runtime.lastError)
		{
			console.warn(chrome.runtime.lastError.message);
			return;
		}

		g_tabId = response.tabId;
		g_docUrl = response.docUrl;
		enableBookmark();
		enableSaveMenu();

		let sourceList = new SourceList(el_sourceList);
		let mediaTypeIsImage = response.mediaType === "image";

		if (mediaTypeIsImage)
		{
			enableSave();

			let options = { title: "source clicked on",
							type: "image",
							showDimensions: true };
			let li = _addSource(response.srcUrl, "image", "", options);

			if (response.srcUrl === response.docUrl)
			{
				return;
			}
		}

		if (response.scanInfo.list && response.scanInfo.list.length)
		{
			enableSave();
			enableSourceMenu();

			for (let i = 0; i < response.scanInfo.list.length; i+=1)
			{
				let video = response.scanInfo.list[i];

				let options = { title: video.title,
								type: "video", 
								showDimensions: true };

				let li = _addSource(video.url, "video", video.title, options);
			}
		}
		else if (response.scanInfo.single)
		{
			enableSave();
			let video = response.scanInfo.single;

			let options = { title: video.title,
							showDimensions: false, 
							download: false };

			let li = _addSource( video.url, "video", video.title, options);
		}

		function _addSource(srcUrl, category, title, options)
		{
			options.onSelect = (elm) => {
				elm.classList.add("active");
				_setState(srcUrl, category, title);
			};
			options.onDeselect = (elm) => {
				elm.classList.remove("active");
			};

			sourceList.addSourceElement(srcUrl, options);
		}

		function _setState(srcUrl, category, title)
		{
			g_meta = { srcUrl: srcUrl, 
					   category: category };
			el_title.value = title;
		}
	});

	el_title.addEventListener("focus", () => {
		el_title.placeholder = "";
	});
	el_title.addEventListener("blur", () => {
		el_title.placeholder = "enter title...";
	});

	styleOnFocus(el_title, el_title.parentElement, "focus");
	styleOnFocus(el_tagContainer, el_tagContainer, "focus");

	function enableSourceMenu()
	{
		el_saveMenu.classList.add("saveMenu--shiftLeft");
		el_sourceMenu.style.display = "block";
	}
	function enableSaveMenu(){ el_saveMenu.style.display = "flex"; }
	function enableSave(){ el_saveBtn.style.display = "inline-block"; }
	function enableBookmark(){ el_bookmarkBtn.style.display = "inline-block"; }

	// mask closes popup
	el_mask.addEventListener("click", () => {
		closePopup();
	});

	// save button
	el_saveBtn.addEventListener("click", function evt(){

		el_saveBtn.removeEventListener("click", evt);
		saveMeta(g_meta.srcUrl, g_meta.category, true);
	});

	// bookmark button
	el_bookmarkBtn.addEventListener("click", function evt(){

		el_bookmarkBtn.removeEventListener("click", evt);
		saveMeta(g_docUrl, "web", false);
	});

	async function saveMeta(srcUrl, category, cache)
	{
		let meta = {
			title: el_title.value,
			tags: g_taggle.getTags().values,
			category: category,
			date: getMinutes(),
			srcUrl: srcUrl,
			docUrl: g_docUrl
		};

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

	// Returns the minutes passed since the Unix Epoch.
	function getMinutes()
	{
		let milli = new Date().getTime();
		let minutes = Math.floor(milli / (1000 * 60));
		return minutes;
	}
}).call(this);