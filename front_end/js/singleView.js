
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

	const UPDATE_MESSAGE = "Successfully updated.",
		  IMAGE_UPDATE_MESSAGE = "Successfully updated image.",
		  NO_MEDIA_MESSAGE = "Could not load media.",
		  NO_LOAD_MESSAGE = "Could not load.",
		  NO_DELETE_MESSAGE = "Could not delete.",
		  NO_UPDATE_MESSAGE = "Could not update.",
		  NO_IMAGE_UPDATE_MESSAGE = "Could not update image.",
		  CANT_HANDLE_MESSAGE = "Something went wrong.",
		  MUST_CONNECT_MESSAGE = "This content is on the desktop app. Must connect to app first.",
		  ENABLE_APP_MESSAGE = "Enable the app in the settings page.";

	const cl_hide   = "noshow", 
		  cl_active = "active", 
		  cl_noTags = "empty";

	const CONTENT_ID  = getIdFromHref(),
		  GALLERY_URL = ApiUtility.getURL("html/gallery.html");

	const el_errorMessage = document.getElementById("error-message");

	const el_contentBlock = document.getElementById("content-block"),
		  el_fileUpload = el_contentBlock.querySelector("#file-upload"),
		  el_chooseImage = el_contentBlock.querySelector("#choose-image");

	const el_infoBlock = document.getElementById("info-block"),
		  el_category = el_infoBlock.querySelector("#category"),
		  el_date = el_infoBlock.querySelector("#date"),
		  el_sourceLink = el_infoBlock.querySelector("#source-link"),
		  el_deleteBtn = el_infoBlock.querySelector("#delete-btn"),
		  el_updateBtn = el_infoBlock.querySelector("#update-btn");

	const el_titleInput = document.getElementById("title-input"),
		  el_tagContainer = document.getElementById("tag-container");

	const TAGGLE_OPTIONS = { placeholder: "add tags..." },
		  CONTENT_CREATOR_OPTIONS = { BEMBlock: "cc", maxHeight: 400, ignoreError: false };

	let g_taggle,
		g_contentCreator,
		g_alerter;

	function main()
	{
		U.injectThemeCss(document.head, ["scrollbar", "alerts", "taggle", "cc", "single-view"], "light", ApiUtility.cssDir);

		g_alerter = new Widgets.AwesomeAlerter();
		document.body.appendChild(g_alerter.alertList);

		g_taggle = MyTaggle.createTaggle(el_tagContainer, TAGGLE_OPTIONS);
		styleOnEmptyTaggle(g_taggle);

		g_contentCreator = new Widgets.ContentCreator(CONTENT_CREATOR_OPTIONS);

		load();
	}

	async function load()
	{
		let info = await requestContent().catch(U.noop);
		if (U.isUdf(info)) return;

		console.log("info:", info);
		createContent(info);
		attachDelete();
		attachUpdate();

		let tags = await ApiUtility.makeRequest({request: "get-tags", to: "background.js"})
		.catch((err) => {
			console.warn("error loading tags:", err);
		});
		if (!tags) return;

		MyTaggle.createAutoComplete(g_taggle, el_tagContainer.parentElement, tags);
	}

	function setErrorMessage(message)
	{
		el_errorMessage.innerText = message;
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
			else if (response.permissionRequired)
			{
				setErrorMessage(NO_LOAD_MESSAGE + " " + MUST_CONNECT_MESSAGE + " " + ENABLE_APP_MESSAGE);
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
			g_alerter.alert(message);
			attachDelete();
		}

		return ApiUtility.makeRequest({request: "delete-content", id: CONTENT_ID, to: "background.js"})
		.then((response) => {
			if (response.success)
			{
				window.history.back();
			}
			else if (response.connectionRequired)
			{
				alertWrapper(NO_DELETE_MESSAGE + " " + MUST_CONNECT_MESSAGE);
			}
			else if (response.permissionRequired)
			{
				alertWrapper(NO_DELETE_MESSAGE + " " + MUST_CONNECT_MESSAGE + " " + ENABLE_APP_MESSAGE);
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

	function attachUpdate()
	{
		el_updateBtn.addEventListener("click", () => {
			requestUpdate({ title: el_titleInput.value,
					 		tags: g_taggle.getTags().values },
					 		UPDATE_MESSAGE,
					 		NO_UPDATE_MESSAGE + " " + CANT_HANDLE_MESSAGE,
					 		NO_UPDATE_MESSAGE + " " + MUST_CONNECT_MESSAGE,
					 		NO_UPDATE_MESSAGE + " " + MUST_CONNECT_MESSAGE + " " + ENABLE_APP_MESSAGE);
		});
		el_updateBtn.disabled = false;
	}

	function requestUpdate(info, successMessage, errMessage, crMessage, prMessage)
	{
		let message = { request: "update-content", 
						id: CONTENT_ID, 
						info: info,
						to: "background.js" };

		return ApiUtility.makeRequest(message).then((response) => {
			if (response.success)
			{
				g_alerter.alert(successMessage);
			}
			else if (response.connectionRequired)
			{
				g_alerter.alert(crMessage);
			}
			else if (response.permissionRequired)
			{
				g_alerter.alert(prMessage);
			}
			else
			{
				console.warn("could not handle response:", response);
				g_alerter.alert(errMessage);
			}
		}).catch((err) => {
			console.warn("error updating content:", err);
			g_alerter.alert(errMessage);
		});
	}

	async function createContent(info)
	{
		U.bindWrap(g_contentCreator.load, g_contentCreator, info).then((elm) => {
			el_contentBlock.prepend(elm);
		}).catch((err) => {
			if (err)
			{
				console.warn(err);
			}
			el_errorMessage.style.margin = 0;
			setErrorMessage(NO_MEDIA_MESSAGE);
		});

		if (info.category === "bookmark")
		{
			U.addClass(el_sourceLink.parentElement, cl_hide);
			enableImageSelect(info);
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

		if (info.docUrl)
		{
			el_sourceLink.href = info.docUrl;
			U.removeClass(el_sourceLink.parentElement, cl_hide);
		}

		U.removeClass(el_infoBlock, cl_hide);
	}

	function enableImageSelect(info)
	{
		let action1 = "Choose Image",
			action2 = "Change Image";

		let p = el_chooseImage.querySelector("p"); 
		p.innerText = info.srcUrl ? action2 : action1;
		U.removeClass(el_chooseImage, cl_hide);

		el_fileUpload.addEventListener("change", () => {
			let imageUrl = URL.createObjectURL(el_fileUpload.files[0]);

			U.wrap(getDataUri, imageUrl).then((uri) => {
				p.innerText = action2;
				el_contentBlock.querySelector("img").src = uri;
				requestUpdate({srcUrl: uri}, 
							  IMAGE_UPDATE_MESSAGE,
							  NO_IMAGE_UPDATE_MESSAGE + " " + CANT_HANDLE_MESSAGE,
							  NO_IMAGE_UPDATE_MESSAGE + " " + MUST_CONNECT_MESSAGE,
							  NO_IMAGE_UPDATE_MESSAGE + " " + MUST_CONNECT_MESSAGE + " " + ENABLE_APP_MESSAGE);
			}).catch(() => {
				g_alerter.alert(NO_IMAGE_UPDATE_MESSAGE + " " + CANT_HANDLE_MESSAGE);
			});
		});

		el_chooseImage.addEventListener("click", () => {
			el_fileUpload.click();
		});
	}

	function getDataUri(url, cb, onErr) {
	    let image = new Image();

	    image.addEventListener("load", function() {
	        let canvas = document.createElement('canvas');
	        canvas.width = this.naturalWidth; // or 'width' if you want a special/scaled size
	        canvas.height = this.naturalHeight; // or 'height' if you want a special/scaled size

	        canvas.getContext('2d').drawImage(this, 0, 0);

	        cb(canvas.toDataURL('image/png'));
	    });

	    image.addEventListener("error", (err) => {
	    	console.warn(err);
	    	onErr();
	    })

	    image.src = url;
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

	main();
})();
