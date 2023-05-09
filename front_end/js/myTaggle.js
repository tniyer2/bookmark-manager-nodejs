
import { extend, joinCallbacks } from "./utility.js";
import { AutoComplete } from "./widgets.js";

const TAG_LENGTH_LIMIT = 30;
const cl_scrollbar = "customScrollbar1";

let TAB = 9;
let ENTER = 13;
let COMMA = 188;

let TAGGLE_DEFAULTS = { submitKeys: [COMMA, ENTER, TAB] };
let AC_TAGGLE_DEFAULTS = { submitKeys: [COMMA] };

function createTaggle(container, options) {

	options = extend(options, TAGGLE_DEFAULTS);

	let taggle = new Taggle(container, options);
	let taggleInput = taggle.getInput();

	taggleInput.maxLength = TAG_LENGTH_LIMIT;

	taggleInput.addEventListener("focus", () => {
		container.dispatchEvent(new Event("focus"));
	});
	taggleInput.addEventListener("blur", () => {
		container.dispatchEvent(new Event("blur"));
	});

	let tagFormatter = joinCallbacks(options.tagFormatter, (li) => {
		li.addEventListener("mousedown", (evt) => {
			evt.preventDefault();
		});
		li.addEventListener("click", (evt) => {
			evt.stopPropagation();

			let text = li.querySelector("span").innerText;
			taggle.remove(text);

			taggleInput.focus();
		});
	});
	let onTagAdd = joinCallbacks(options.onTagAdd, (evt, text) => {
		container.scrollTop = container.scrollHeight;
	});
	taggle.setOptions({tagFormatter: tagFormatter, onTagAdd: onTagAdd});

	return taggle;
};

function createAutoComplete(taggle, parentElement, values) {

	let taggleInput = taggle.getInput();
	let confirmEvent = new KeyboardEvent("keydown", {keyCode: COMMA});
	let confirmInput = () => { taggleInput.dispatchEvent(confirmEvent); };

	let acOptions = { values: values,
					  onConfirm: confirmInput };
	let ac = new AutoComplete(taggleInput, parentElement, acOptions);
	ac.el_list.classList.add(cl_scrollbar);
	taggle.setOptions(AC_TAGGLE_DEFAULTS);
};

export { createTaggle, createAutoComplete };
