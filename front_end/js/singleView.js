
import { CSS_DIR, getParams, injectThemeCss, noop, isUdf, addClass, removeClass, wrap, bindWrap, joinCallbacks, makeRequest } from "./utility.js";
import { AwesomeAlerter, ContentCreator } from "./widgets.js";
import { createTaggle, createAutoComplete } from "./myTaggle.js";

const formatDate = (function(){
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
		  CANT_HANDLE_MESSAGE = "Something went wrong.";

	const cl_hide   = "noshow", 
		  cl_active = "active", 
		  cl_noTags = "empty";

	const GALLERY_URL = chrome.runtime.getURL("./gallery.html");

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

	let g_contentId;

	function main()
	{
		const params = getParams();
		g_contentId = params.get("id");
		const theme = params.get("theme") || "light";
		injectThemeCss(document.head, ["scrollbar", "alerts", "taggle", "cc", "single-view"], theme, chrome.runtime.getURL(CSS_DIR));

		g_alerter = new AwesomeAlerter();
		document.body.appendChild(g_alerter.alertList);

		g_taggle = createTaggle(el_tagContainer, TAGGLE_OPTIONS);
		styleOnEmptyTaggle(g_taggle);

		g_contentCreator = new ContentCreator(CONTENT_CREATOR_OPTIONS);

		load();
	}

	async function load()
	{
		let info = await requestContent().catch(noop);
		if (isUdf(info)) return;

		console.log("info:", info);
		createContent(info);
		attachDelete();
		attachUpdate();

		let tags = await makeRequest({request: "get-tags", to: "background.js"})
		.catch((err) => {
			console.warn("error loading tags:", err);
		});
		if (!tags) return;

		createAutoComplete(g_taggle, el_tagContainer.parentElement, tags);
	}

	function setErrorMessage(message)
	{
		el_errorMessage.innerText = message;
		removeClass(el_errorMessage, cl_hide);
	}

	function requestContent()
	{
		return makeRequest({request: "find-content", id: g_contentId, to: "background.js"})
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

		return makeRequest({request: "delete-content", id: g_contentId, to: "background.js"})
		.then((response) => {
			if (response.success)
			{
				window.history.back();
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
					 		NO_UPDATE_MESSAGE + " " + CANT_HANDLE_MESSAGE);
		});
		el_updateBtn.disabled = false;
	}

	function requestUpdate(info, successMessage, errMessage)
	{
		let message = { request: "update-content", 
						id: g_contentId, 
						info: info,
						to: "background.js" };

		return makeRequest(message).then((response) => {
			if (response.success)
			{
				g_alerter.alert(successMessage);
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
		bindWrap(g_contentCreator.load, g_contentCreator, info).then((elm) => {
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
			addClass(el_sourceLink.parentElement, cl_hide);
			enableImageSelect(info);
		}

		el_titleInput.value = info.title;
		removeClass(el_titleInput, cl_hide);

		for (let i = 0, l = info.tags.length; i < l; i+=1)
		{
			g_taggle.add(info.tags[i]);
		}
		removeClass(el_tagContainer, cl_active);
		removeClass(el_tagContainer, cl_hide);

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
			removeClass(el_sourceLink.parentElement, cl_hide);
		}

		removeClass(el_infoBlock, cl_hide);
	}

	function enableImageSelect(info)
	{
		let action1 = "Choose Image",
			action2 = "Change Image";

		let p = el_chooseImage.querySelector("p"); 
		p.innerText = info.srcUrl ? action2 : action1;
		removeClass(el_chooseImage, cl_hide);

		el_fileUpload.addEventListener("change", () => {
			let imageUrl = URL.createObjectURL(el_fileUpload.files[0]);

			wrap(getDataUri, imageUrl).then((uri) => {
				p.innerText = action2;
				el_contentBlock.querySelector("img").src = uri;
				requestUpdate({srcUrl: uri}, 
							  IMAGE_UPDATE_MESSAGE,
							  NO_IMAGE_UPDATE_MESSAGE + " " + CANT_HANDLE_MESSAGE);
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

	function styleOnEmptyTaggle(taggle)
	{
		function inner()
		{
			let container = taggle.getContainer();
			if (taggle.getTags().values.length)
			{
				removeClass(container, cl_noTags);
			}
			else
			{
				addClass(container, cl_noTags);
			}
		}

		inner();
		let add = joinCallbacks(taggle.settings.onTagAdd, inner);
		let remove = joinCallbacks(taggle.settings.onTagRemove, inner);
		taggle.setOptions({onTagAdd: add, onTagRemove: remove});
	}

	main();
})();
