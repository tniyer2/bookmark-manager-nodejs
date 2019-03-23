
const glb_mask  = document.getElementById("mask");
const glb_title = document.getElementById("title");
const glb_save 	= document.getElementById("save");
const glb_bookmark = document.getElementById("bookmark");
const glb_saveMenu = document.getElementById("saveMenu");
const glb_sourceMenu = document.getElementById("sourceMenu");
const glb_sourceList = document.getElementById("sourceList");
const glb_test = document.createElement("canvas");

let glb_saveInfo;
let glb_docUrl;
let glb_tabId;

let glb_myTaggle = new Taggle("tags", {});
let glb_selectedList;

chrome.runtime.sendMessage({request: "get-popupInfo"}, (response) => {

	if (chrome.runtime.lastError)
	{
		console.warn(chrome.runtime.lastError.message);
		return;
	}

	let creator = new ListCreator();
	glb_tabId = response.tabId;

	enableBookmark();
	glb_docUrl = response.docUrl;

	let mediaTypeIsImage = response.mediaType === "image";
	if (mediaTypeIsImage)
	{
		enableSave();
		_setMainSource(response.srcUrl, response.mediaType, "");

		if (response.docUrl === response.srcUrl)
		{
			return;
		}
	}

	if (response.scanInfo.list && response.scanInfo.list.length)
	{
		enableSave();
		glb_saveMenu.classList.add("saveMenu--shiftLeft");
		glb_saveMenu.style.display = "flex";
		glb_sourceMenu.style.display = "block";

		if (mediaTypeIsImage)
		{
			let li = _createList(response.srcUrl, response.mediaType, "");
			li.click();
		}

		for (let i = 0; i < response.scanInfo.list.length; i+=1)
		{
			let video = response.scanInfo.list[i];

			let li = _createList(video.url, "video", video.title);
			if (!mediaTypeIsImage && i === 0)
			{
				_setMainSource(video.url, "video", video.title);
				li.click();
			}
		}
	}
	else if (response.scanInfo.single)
	{
		let video = response.scanInfo.single;

		_createList(video.url, "video", video.title, { showDimensions: false });
		_setMainSource(video.url, "video", video.title);
	}
	glb_saveMenu.style.display = "flex";

	function _setMainSource(srcUrl, category, title)
	{
		glb_saveInfo = { srcUrl: srcUrl, 
						 category: category };
		glb_title.value = title;
	}

	function _createList(srcUrl, category, title, options)
	{
		let li = creator.createList(srcUrl, category, title, options);

		li.addEventListener("click", () => {
			if (glb_selectedList)
			{
				glb_selectedList.classList.remove("sourceMenu__tag--active");
			}
			glb_selectedList = li;
			li.classList.add("sourceMenu__tag--active");

			_setMainSource(srcUrl, category, title);
		});

		glb_sourceList.appendChild(li);
		return li;
	}
});

// mask closes popup
glb_mask.addEventListener("click", () => {
	closePopup();
});

// save button
glb_save.addEventListener("click", function evt(){

	glb_save.removeEventListener("click", evt);
	saveMeta(glb_saveInfo.srcUrl, glb_saveInfo.category, true);
});

// bookmark button
glb_bookmark.addEventListener("click", function evt(){

	glb_bookmark.removeEventListener("click", evt);
	saveMeta(glb_docUrl, "web", false);
});

function enableSave(){glb_save.style.display = "inline-block"};
function enableBookmark(){glb_bookmark.style.display = "inline-block"};

async function saveMeta(srcUrl, category, cache)
{
	let meta = {
		title: glb_title.value,
		tags: glb_myTaggle.getTags().values,
		category: category,
		date: getMinutes(),
		srcUrl: srcUrl,
		docUrl: glb_docUrl
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
	chrome.tabs.sendMessage(glb_tabId, {to: "content.js", close: true});
}

// Returns the minutes passed since the Unix Epoch.
function getMinutes()
{
	let milli = new Date().getTime();
	let minutes = Math.floor(milli / (1000 * 60));
	return minutes;
}
