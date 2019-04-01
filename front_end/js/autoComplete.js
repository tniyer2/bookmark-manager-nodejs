
(function(){

	const cl_hide = "noshow";
	const cl_li = "save-menu__autoc-li";
	const cl_activeLi = "active";
	const preventDefault = (evt) => {evt.preventDefault();};

	this.autoComplete = class{

		constructor(input, list, values, onConfirm) {
			
			this.input = input;
			this.list = list;
			this.values = values;
			this.onConfirm = onConfirm;

			this._attachEvents();
		}

		_update(text) {
			if (!text)
			{
				this._close();
			}
			else
			{
				let newValues = this._getSimilarValues(text, getTimesFound);
				if (newValues.length > 0)
				{
					this._setList(newValues);
					this._show();
				}
				else
				{
					this._close();
				}
			}
		}

		_scroll(inward) {
			if (this.selected)
			{
				if (inward)
				{
					if (this.selected.nextSibling)
					{
						this.selected = this.selected.nextSibling;
					}
				}
				else
				{
					if (this.selected.previousSibling)
					{
						this.selected = this.selected.previousSibling;
					}
				}
			}
			else
			{
				this.selected = this.list.firstChild;
			}
		}

		_confirm(value) {
			if (value)
			{
				this.input.value = value;	
			}

			this.onConfirm();
			this._close();
		}

		get selected() {
			return this._selected;
		}

		set selected(elm) {

			if (this._selected)
			{
				this._selected.classList.remove(cl_activeLi);
			}

			if (elm)
			{
				elm.classList.add(cl_activeLi);
			}
			this._selected = elm;
		}

		_attachEvents() {
			this.input.addEventListener("input", (evt) => {
				this._update(this.input.value);
			});
			this.input.addEventListener("blur", (evt) => {
				this._close();
			});

			this.input.addEventListener("keydown", (evt) => {
				if (evt.key === "ArrowUp")
				{
					evt.preventDefault();
					this._scroll(false);
				}
				else if (evt.key === "ArrowDown")
				{
					evt.preventDefault();
					this._scroll(true);
				}
				else if (evt.key === "Enter")
				{
					if (this._isOpen())
					{
						if (this.selected)
						{
							this._confirm(this.selected.innerText);
						}
						else
						{
							this._close();
							this._confirm();
						}
					}
					else
					{
						this._confirm();
					}
				}
			});
		}

		_getSimilarValues(text, comp) {
			let cache = {};
			for (let i = 0, l = this.values.length; i < l; i+=1)
			{
				let sim = comp(this.values[i], text);
				cache[this.values[i]] = sim;
			}

			let similarValues = this.values.slice();
			similarValues = similarValues.filter((s) => {
				return cache[s] > 0;
			});
			similarValues = similarValues.sort((s1, s2) => {
				return cache[s2] - cache[s1];
			});

			return similarValues;
		}

		_setList(newValues) {
			this._clearList();

			for (let i = 0, l = newValues.length; i < l; i+=1)
			{
				let li = this._createListElement(newValues[i]);
				this.list.appendChild(li);
			}
		}

		_createListElement(value) {

			let li = document.createElement("li");
			li.classList.add(cl_li);

			li.addEventListener("mouseenter", () => {
				this.selected = li;
			});
			li.addEventListener("mouseleave", () => {
				this.selected = null;
			});
			li.addEventListener("click", (evt) => {
				evt.preventDefault();
				this._confirm(value);
			});
			li.addEventListener("mousedown", (evt) => {
				evt.preventDefault();
			});

			let textNode = document.createTextNode(value);
			li.appendChild(textNode);

			return li;
		}

		_clearList() {
			this.selected = null;

			let child = this.list.firstChild;
			while (child)
			{
				this.list.removeChild(child);
				child = this.list.firstChild;
			}
		}

		_isOpen() {
			return !this.list.classList.contains(cl_hide);
		}

		_show() {
			if (this.list.classList.contains(cl_hide))
			{
				this.list.classList.remove(cl_hide);
			}
		}

		_hide() {
			if (!this.list.classList.contains(cl_hide))
			{
				this.list.classList.add(cl_hide);
			}
		}

		_close() {

			this._hide();
			this._clearList();
		}
	}

	function getTimesFound(bigString, smallString) {

		let count = 0;
		let found = 0;
		while (true)
		{
			found = bigString.indexOf(smallString, found);
			if (found === -1)
			{
				break;
			}
			else
			{
				count += 1;
				found +=1;
			}
		}

		return count;
	}

}).call(this);
