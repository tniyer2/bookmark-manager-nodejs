
this.formatDate = (function(){
	const SECOND = 1000;
	const MINUTE = 60 * SECOND;
	const HOUR = 60 * MINUTE;
	const DAY = 24 * HOUR;
	const MONTH_NAMES = [ "Jan", "Feb", "Mar",
						  "Apr", "May", "Jun",
						  "Jul", "Aug", "Sept",
						  "Oct", "Nov", "Dec" ];
	return function(ms) {
		let now = new Date();
		let offset = now.getTime() - ms;
		let val, unit;
		if (offset < DAY)
		{
			if (offset < MINUTE)
			{
				val = Math.floor(offset / SECOND);
				unit = "second";
			}
			else if (offset < HOUR)
			{
				val = Math.floor(offset / MINUTE);
				unit = "minute";
			}
			else
			{
				val = Math.floor(offset / HOUR);
				unit = "hour";
			}
			let plural = val === 1 ? "" : "s";
			return val + " " + unit + plural + " ago";
		}
		else
		{
			let then = new Date(ms);

			let currentYear = now.getFullYear();
			let otherYear = then.getFullYear();
			let year = currentYear === otherYear ? "" : " " + otherYear;

			let month = MONTH_NAMES[then.getMonth()];
			let day = then.getDate();

			return month + " " + day + year;
		}
	};
})();

(function(){

	const NO_LOAD_MESSAGE      = "Could not load.",
		  NO_DELETE_MESSAGE    = "Could not delete.",
		  NO_UPDATE_MESSAGE    = "Could not update.",
		  CANT_HANDLE_MESSAGE  = "Something went wrong.",
		  MUST_CONNECT_MESSAGE = "This content is on the desktop app. Must connect to app first.";

	const ALERT_DELAY = 5;

	const CONTENT_ID = getIdFromHref();
	const GALLERY_URL = chrome.runtime.getURL("html/gallery.html");
	const cl_hide = "noshow";

	const el_contentBlock = document.getElementById("content-block");

	const el_infoBlock = document.getElementById("info-block");
	const el_category = el_infoBlock.querySelector("#category");
	const el_date = el_infoBlock.querySelector("#date");
	const el_sourceLink = el_infoBlock.querySelector("#source-link");
	const el_deleteBtn = el_infoBlock.querySelector("#delete-btn");
	const el_updateBtn = el_infoBlock.querySelector("#update-btn");

	const el_titleInput = document.getElementById("title-input");
	const el_tagContainer = document.getElementById("tag-container");

	const g_taggle = MyTaggle.createTaggle(el_tagContainer, {});
	const g_alerter = new Widgets.AwesomeAlerter(document.body, {BEMBlock: "alerts"});

	let g_settings;

	return function() {
		U.injectThemeCss(document.head, ["scrollbar", "alerts", "taggle", "single-view"], "light");
		load();
	};

	async function load()
	{
		let content = await requestContent().catch(onNoLoad);
		if (U.isUdf(content)) return;

		createContent(content);
		attachDelete();
		el_updateBtn.addEventListener("click", requestUpdate, {once: false});
		el_updateBtn.disabled = false;

		let tags = await ApiUtility.makeRequest({request: "get-tags"})
		.catch((err) => {
			console.warn("error loading tags:", err);
		});
		if (!tags) return;

		MyTaggle.createAutoComplete(g_taggle, el_tagContainer.parentElement, tags);
	}

	function onNoLoad()
	{
		alert("problem loading");
	}

	function requestContent()
	{
		return ApiUtility.makeRequest({request: "find-content", id: CONTENT_ID})
		.then((response) => {
			if (response.content)
			{
				return response.content;
			}
			else if (response.connectionRequired)
			{
				g_alerter.alert(NO_LOAD_MESSAGE + " " + MUST_CONNECT_MESSAGE, ALERT_DELAY);
				throw new Error();
			}
			else
			{
				console.warn("could not handle response:", response);
				g_alerter.alert(NO_LOAD_MESSAGE + " " + CANT_HANDLE_MESSAGE, ALERT_DELAY);
				throw new Error();
			}
		}).catch((err) => {
			console.warn("error loading content:", err);
			g_alerter.alert(NO_LOAD_MESSAGE + " " + CANT_HANDLE_MESSAGE, ALERT_DELAY);
			throw new Error();
		});
	}

	function attachDelete()
	{
		el_deleteBtn.addEventListener("click", requestDelete, {once: true});
		el_deleteBtn.disabled = false;
	}

	function requestDelete()
	{
		function alertWrapper(message)
		{
			g_alerter.alert(message, ALERT_DELAY);
			attachDelete();
		}

		ApiUtility.makeRequest({request: "delete-content", id: CONTENT_ID})
		.then((response) => {
			if (response.success)
			{
				window.history.back();
			}
			else if (response.connectionRequired)
			{
				alertWrapper(NO_DELETE_MESSAGE + " " + MUST_CONNECT_MESSAGE);
			}
			else
			{
				console.warn("could not handle response:", response);
				alertWrapper(NO_DELETE_MESSAGE + " " + CANT_HANDLE_MESSAGE);
			}
		}).catch((err) => {
			console.warn("error deleting content:", err);
			alertWrapper(NO_DELETE_MESSAGE + " " + CANT_HANDLE_MESSAGE);
		});
	}

	function requestUpdate()
	{
		function alertWrapper(message)
		{
			g_alerter.alert(message, ALERT_DELAY);
		}

		let info = { title: el_titleInput.value,
					 tags: g_taggle.getTags().values };

		let message = { request: "update-content", 
						id: CONTENT_ID, info: info };

		ApiUtility.makeRequest(message).then((response) => {
			if (response.success)
			{
				alertWrapper("Successfully updated.");
			}
			else if (response.connectionRequired)
			{
				alertWrapper(NO_UPDATE_MESSAGE + " " + MUST_CONNECT_MESSAGE);
			}
			else
			{
				console.warn("could not handle response:", response);
				alertWrapper(NO_UPDATE_MESSAGE + " " + CANT_HANDLE_MESSAGE);
			}
		}).catch((err) => {
			console.warn("error updating content:", err);
			alertWrapper(NO_UPDATE_MESSAGE + " " + CANT_HANDLE_MESSAGE);
		});
	}

	function createContent(content)
	{
		console.log("content:", content);

		let source = content.path ? content.path : content.srcUrl;
		let el_content;
		if (content.category === "image")
		{
			el_content = ContentCreator.createImage(source);
			el_content.classList.add("content-block__image");
		}
		else if (content.category === "video")
		{
			el_content = ContentCreator.createVideo(source);
			el_content.classList.add("content-block__video");
		}
		else if (content.category === "bookmark")
		{
			el_content = ContentCreator.createBookmark(source, content.docUrl);
			el_content.classList.add("content-block__favicon");
			el_sourceLink.parentElement.classList.add("noshow");
		}
		else if (content.category === "youtube")
		{
			el_content = ContentCreator.createIframe(source);
			el_content.classList.add("content-block__youtube");
		}
		else
		{
			console.log("can not handle content category:", content);
			return;
		}

		el_content.classList.add("content-block__content");
		el_contentBlock.appendChild(el_content);

		el_titleInput.value = content.title;
		U.removeClass(el_titleInput, cl_hide);

		for (let i = 0, l = content.tags.length; i < l; i+=1)
		{
			g_taggle.add(content.tags[i]);
		}
		U.removeClass(el_tagContainer, cl_hide);

		let formattedCategory = formatCategory(content.category);
		let categoryTextNode = document.createTextNode(formattedCategory);
		el_category.appendChild(categoryTextNode);

		let ms = Number(content.date);
		let formattedDate = formatDate(ms);
		let dateTextNode = document.createTextNode(formattedDate);
		el_date.appendChild(dateTextNode);

		el_sourceLink.href = content.docUrl;

		U.removeClass(el_infoBlock, cl_hide);
	}

	function formatCategory(category)
	{
		return category.substring(0, 1).toUpperCase() + category.substring(1);
	}

	function getIdFromHref()
	{
		let decoded = decodeURI(location.search);
		let index 	= decoded.indexOf("?");

		let id;
		if (index == decoded.length - 1)
		{
			id = "";
		}
		else
		{
			id = decoded.substring(index + 1);
		}

		return id;
	}
})()();
