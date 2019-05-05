
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
		  MUST_CONNECT_MESSAGE = "This content is on the desktop app. Must connect to app first.",
		  ALERT_DELAY = 5;

	const cl_hide   = "noshow", 
		  cl_active = "active", 
		  cl_noTags = "empty";

	const CONTENT_ID  = getIdFromHref(),
		  GALLERY_URL = chrome.runtime.getURL("html/gallery.html");

	const el_errorMessage = document.getElementById("error-message");

	const el_contentBlock = document.getElementById("content-block");

	const el_infoBlock = document.getElementById("info-block"),
		  el_category = el_infoBlock.querySelector("#category"),
		  el_date = el_infoBlock.querySelector("#date"),
		  el_sourceLink = el_infoBlock.querySelector("#source-link"),
		  el_deleteBtn = el_infoBlock.querySelector("#delete-btn"),
		  el_updateBtn = el_infoBlock.querySelector("#update-btn");

	const el_titleInput = document.getElementById("title-input");
	const el_tagContainer = document.getElementById("tag-container");

	const TAGGLE_OPTIONS = { placeholder: "add tags..." },
		  ALERTER_OPTIONS = { BEMBlock: "alerts" },
		  CONTENT_CREATOR_OPTIONS = { BEMBlock: "content-block" };

	let g_taggle,
		g_contentCreator,
		g_alerter;

	let g_settings;

	return function() {
		U.injectThemeCss(document.head, ["scrollbar", "alerts", "taggle", "single-view"], "light");

		g_alerter = new Widgets.AwesomeAlerter(ALERTER_OPTIONS);

		TAGGLE_OPTIONS.alerter = g_alerter;
		g_taggle = MyTaggle.createTaggle(el_tagContainer, TAGGLE_OPTIONS);
		styleOnEmptyTaggle(g_taggle);

		g_contentCreator = new Widgets.ContentCreator(CONTENT_CREATOR_OPTIONS);

		document.body.appendChild(g_alerter.alertList);
		load();
	};

	async function load()
	{
		let content = await requestContent().catch(U.noop);
		if (U.isUdf(content)) return;

		createContent(content);
		attachDelete();
		el_updateBtn.addEventListener("click", requestUpdate, {once: false});
		el_updateBtn.disabled = false;

		let tags = await ApiUtility.makeRequest({request: "get-tags", to: "background.js"})
		.catch((err) => {
			console.warn("error loading tags:", err);
		});
		if (!tags) return;

		MyTaggle.createAutoComplete(g_taggle, el_tagContainer.parentElement, tags);
	}

	function setErrorMessage(message)
	{
		let textNode = document.createTextNode(message);
		el_errorMessage.appendChild(textNode);
		U.removeClass(el_errorMessage, cl_hide);
	}

	function requestContent()
	{
		return ApiUtility.makeRequest({request: "find-content", id: CONTENT_ID, to: "background.js"})
		.catch((err) => {
			console.warn("error loading content:", err);
			setErrorMessage(NO_LOAD_MESSAGE + " " + CANT_HANDLE_MESSAGE);
			throw new Error();
		})
		.then((response) => {
			if (response.content)
			{
				return response.content;
			}
			else if (response.connectionRequired)
			{
				setErrorMessage(NO_LOAD_MESSAGE + " " + MUST_CONNECT_MESSAGE);
				throw new Error();
			}
			else
			{
				console.warn("could not handle response:", response);
				setErrorMessage(NO_LOAD_MESSAGE + " " + CANT_HANDLE_MESSAGE);
				throw new Error();
			}
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

		ApiUtility.makeRequest({request: "delete-content", id: CONTENT_ID, to: "background.js"})
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
						id: CONTENT_ID, 
						info: info,
						to: "background.js" };

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

	async function createContent(info)
	{
		console.log("info:", info);

		let source = info.path ? info.path : info.srcUrl;
		
		let el_content = await U.bindWrap(g_contentCreator.load, g_contentCreator, info);
		el_content.classList.add("content-block__content");
		el_contentBlock.appendChild(el_content);

		if (info.category === "bookmark")
		{
			U.addClass(el_sourceLink.parentElement, cl_hide);
		}

		el_titleInput.value = info.title;
		U.removeClass(el_titleInput, cl_hide);

		for (let i = 0, l = info.tags.length; i < l; i+=1)
		{
			g_taggle.add(info.tags[i]);
		}
		U.removeClass(el_tagContainer, cl_active);
		U.removeClass(el_tagContainer, cl_hide);

		let formattedCategory = formatCategory(info.category);
		let categoryTextNode = document.createTextNode(formattedCategory);
		el_category.appendChild(categoryTextNode);

		let ms = Number(info.date);
		let formattedDate = formatDate(ms);
		let dateTextNode = document.createTextNode(formattedDate);
		el_date.appendChild(dateTextNode);

		el_sourceLink.href = info.docUrl;

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

	function styleOnEmptyTaggle(taggle)
	{
		function inner()
		{
			let container = taggle.getContainer();
			if (taggle.getTags().values.length)
			{
				U.removeClass(container, cl_noTags);
			}
			else
			{
				U.addClass(container, cl_noTags);
			}
		}

		inner();
		let add = U.joinCallbacks(taggle.settings.onTagAdd, inner);
		let remove = U.joinCallbacks(taggle.settings.onTagRemove, inner);
		taggle.setOptions({onTagAdd: add, onTagRemove: remove});
	}
})()();
