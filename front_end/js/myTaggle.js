
const MyTaggle = {};
(function(){
	const TAG_CHARCTER_LIMIT = 30;
	const COMMA_CODE = 188;
	const cl_scrollbar = "customScrollbar1";

	this.createTaggle = function(container, options) {
		options.submitKeys = [COMMA_CODE];

		let taggle = new Taggle(container, options);
		let taggleInput = taggle.getInput();

		taggleInput.maxLength = TAG_CHARCTER_LIMIT;

		taggleInput.addEventListener("focus", () => {
			container.dispatchEvent(new Event("focus"));
		});
		taggleInput.addEventListener("blur", () => {
			container.dispatchEvent(new Event("blur"));
		});

		taggle.setOptions({tagFormatter: (li) => {
			li.addEventListener("click", (evt) => {
				evt.stopPropagation();

				let text = li.querySelector("span").innerText;
				taggle.remove(text);

				if (!taggle.getTags().values.length)
				{
					taggleInput.focus();
				}
			});
		}, onTagAdd: (evt, text) => {
			container.scrollTop = container.scrollHeight;
			// alerter.alert("tag added: " + text, 3);
		}});

		return taggle;
	};

	this.createAutoComplete = function(taggle, parentElement, values) {
		let taggleInput = taggle.getInput();
		let confirmEvent = new KeyboardEvent("keydown", {keyCode: COMMA_CODE});
		let confirmInput = () => { taggleInput.dispatchEvent(confirmEvent); };

		let ac = new Widgets.AutoComplete(taggleInput, parentElement, 
					 { BEMBlock: "",
					   values: values, 
					   onConfirm: confirmInput });
		ac.el_list.classList.add(cl_scrollbar);
	};
}).call(MyTaggle);
