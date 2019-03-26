
const glb_test = document.createElement("canvas");
const glb_mask  = document.getElementById("mask");
const glb_saveMenu = document.getElementById("saveMenu");

const glb_title = document.getElementById("title");
const glb_tagArea = document.getElementById("tagArea");
const glb_save 	= document.getElementById("save");
const glb_bookmark = document.getElementById("bookmark");

const glb_sourceMenu = document.getElementById("sourceMenu");
const glb_sourceList = document.getElementById("sourceList");

let dispatchFocus = () => {glb_tagArea.dispatchEvent(new Event("focus"));}
let dispatchBlur  = () => {glb_tagArea.dispatchEvent(new Event("blur"));}
let taggle_options = { placeholder: "enter tags...",  
					   focusInputOnContainerClick: true,
					   onFocusInput: dispatchFocus, 
					   onBlurInput: dispatchBlur };
let glb_myTaggle = new Taggle(glb_tagArea, taggle_options);

let glb_saveInfo;
let glb_docUrl;
let glb_tabId;

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
		let li = _createList( response.srcUrl, 
							  response.mediaType, 
							  "", 
							  "source clicked on");
		li.click();

		if (response.docUrl === response.srcUrl)
		{
			return;
		}
	}

	if (response.scanInfo.list && response.scanInfo.list.length)
	{
		enableSave();
		enableSaveMenu();
		enableSourceMenu();

		for (let i = 0; i < response.scanInfo.list.length; i+=1)
		{
			let video = response.scanInfo.list[i];

			let li = _createList(video.url, "video", video.title);
			if (!glb_saveInfo && i === 0)
			{
				li.click();
			}
		}
	}
	else if (response.scanInfo.single)
	{
		enableSave();
		let video = response.scanInfo.single;

		let li = _createList( video.url, 
							  "video", 
							  video.title, 
							  { showDimensions: false, 
							  	download: false });
		li.click();
	}
	enableSaveMenu();

	function _createList(srcUrl, category, title, placeholder, options)
	{
		if (typeof placeholder === "object")
		{
			options = placeholder;
			placeholder = undefined;
		}
		if (!placeholder)
		{
			placeholder = title;
		}

		let li = creator.createList(srcUrl, category, placeholder, options);

		li.addEventListener("click", (event) => {

			if (glb_selectedList)
			{
				glb_selectedList.classList.remove("sourceMenu__tag--active");
			}
			glb_selectedList = li;
			li.classList.add("sourceMenu__tag--active");

			_setSaveInfo(srcUrl, category, title);
		});

		glb_sourceList.appendChild(li);
		return li;
	}

	function _setSaveInfo(srcUrl, category, title)
	{
		glb_saveInfo = { srcUrl: srcUrl, 
						 category: category };
		glb_title.value = title;
	}
});

glb_title.addEventListener("focus", () => {
	glb_title.placeholder = "";
});
glb_title.addEventListener("blur", () => {
	glb_title.placeholder = "enter title...";
});

addClassOnAwesomeFocus(glb_title, glb_title.parentElement, "focus");
addClassOnAwesomeFocus(glb_tagArea, glb_tagArea, "focus");

function addClassOnAwesomeFocus(target, element, classname)
{
	new awesomeFocus(target, () => {
		if (!element.classList.contains(classname))
		{
			element.classList.add(classname);
		}
	}, () => {
		if (element.classList.contains(classname))
		{
			element.classList.remove(classname);
		}
	});
}

function enableSourceMenu()
{
	glb_saveMenu.classList.add("saveMenu--shiftLeft");
	glb_sourceMenu.style.display = "block";
}
function enableSaveMenu(){ glb_saveMenu.style.display = "flex"; }
function enableSave(){ glb_save.style.display = "inline-block"; }
function enableBookmark(){ glb_bookmark.style.display = "inline-block"; }

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
