
let Widgets = {};
(function(){
	let self = this;

	this.AwesomeFocus = class {
		constructor(target, onfocus, onblur)
		{
			this._target = target;
			this._onfocus = onfocus;
			this._onblur = onblur;

			this._listenMouse();
			this._attachEvents();
		}

		_attachEvents()
		{
			this._target.addEventListener("focus", () => {
				this._removeMouse();
			});
			this._target.addEventListener("blur", () => {
				this._listenMouse();
				this._onblur();
			});
		}

		_listenMouse()
		{
			this._target.addEventListener("mouseenter", this._onfocus);
			this._target.addEventListener("mouseleave", this._onblur);
		}

		_removeMouse()
		{
			this._target.removeEventListener("mouseenter", this._onfocus);
			this._target.removeEventListener("mouseleave", this._onblur);
		}
	};

	this.styleOnFocus = function(target, elm, cl) {
		new self.AwesomeFocus(target, () => {
			if (!elm.classList.contains(cl))
			{
				elm.classList.add(cl);
			}
		}, () => {
			if (elm.classList.contains(cl))
			{
				elm.classList.remove(cl);
			}
		});
	};

	this.ListManager = (function(){
		const SVGNS   = "http://www.w3.org/2000/svg";
		const XLINKNS = "http://www.w3.org/1999/xlink";

		const cl_source = "source-menu__source";
		const cl_activeSource = "active";
		const cl_tagList = "source-menu__tag-list";
		const cl_tag  = ["source-menu__tag", "theme"];
		const cl_copyBtn = "source-menu__copy";
		const cl_downloadBtn = "source-menu__download";
		const cl_svg  = ["source-menu__svg", "theme"];

		const CLASS_DEFAULTS = { selectFirst: true,
								 // @param li selected element
								 // @param data data associated with the element
								 onSelect: noop,
								 // same signature
								 onDeselect: noop };
		const SOURCE_DEFAULTS = { allowCopy: true,
								  allowDownload: true,
								  type: "",
								  showDimensions: false,
								  showExtension: true,
								  title: "source",
								  data: null };

		return class {
			constructor(list, options)
			{
				this._el_list = list;
				this._data = [];

				this._options = extend(CLASS_DEFAULTS, options);
				this._el_test = document.createElement("canvas");
			}

			get selected()
			{
				return this._selected;
			}
			// obj should be {li, data}
			set selected(obj)
			{
				if (this._selected)
				{
					this._selected.li.classList.remove(cl_activeSource);
					this._options.onDeselect(this._selected.li, this._selected.data);
				}

				obj.li.classList.add(cl_activeSource);
				this._options.onSelect(obj.li, obj.data);
				this._selected = obj;
			}

			addSource(srcUrl, sourceOptions)
			{
				sourceOptions = extend(SOURCE_DEFAULTS, sourceOptions);

				const el_source = document.createElement("li");
				addClasses(el_source, cl_source);

				const titleTextNode = document.createTextNode(sourceOptions.title);
				el_source.appendChild(titleTextNode);

				const el_tagList = document.createElement("ul");
				addClasses(el_tagList, cl_tagList);
				el_source.appendChild(el_tagList);

				if (sourceOptions.showExtension === true)
				{
					let tag = this._createExtensionTag(srcUrl);
					if (tag)
					{
						el_tagList.appendChild(tag);
					}
				}

				if (sourceOptions.showDimensions === true)
				{
					(async () => {
						let tag = await bindWrap(this._createDimensionsTag, this,
												 srcUrl, sourceOptions.type);
						el_tagList.appendChild(tag);
					})();
				}

				if (sourceOptions.allowCopy === true)
				{
					let copyBtn = this._createCopySVG(srcUrl);
					el_source.appendChild(copyBtn);
				}

				if (sourceOptions.allowDownload === true)
				{
					let downloadBtn = this._createDownloadSVG(srcUrl);
					el_source.appendChild(downloadBtn);
				}

				let selectedData = {li: el_source, data: sourceOptions.data};
				if (this._options.selectFirst === true)
				{
					if (!this.selected)
					{
						this.selected = selectedData;
					}
				}

				el_source.addEventListener("click", () => {
					this.selected = selectedData;
				});

				this._el_list.appendChild(el_source);
				return el_source;
			}

			_createExtensionTag(url)
			{
				let arr = parseFileName(url, true);
				let ext = arr ? arr[1].substring(1) : null;

				if (ext)
				{
					let elm = this._createTag(ext);
					return elm;
				}
				else
				{
					return null;
				}
			}

			_createDimensionsTag(url, type, successCallback, errorCallback)
			{
				if (type === "image")
				{
					this._testImageDimensions(url, (w, h) => {
						console.log(`image loaded (${w}, ${h}):`, url);

						let tag = this._createTag(w + "x" + h);
						successCallback(tag);
					});
				}
				else if (type === "video")
				{
					this._testVideoDimensions(url, (w, h) => {
						console.log(`video loaded (${w}, ${h}):`, url);

						let tag = this._createTag(h + "p");
						successCallback(tag);
					});
				}
				else
				{
					let e = "type should not be " + type;
					errorCallback(new Error(e));
				}
			}

			_testImageDimensions(url, callback)
			{
				let elm = document.createElement("img");
				elm.src = url;

				elm.addEventListener("loadedmetadata", () => {
					callback(elm.naturalWidth, elm.naturalHeight);
					this._el_test.removeChild(elm);
				});
				elm.addEventListener("error", (e) => {
					console.warn(e);
				});

				this._el_test.appendChild(elm);
			}

			_testVideoDimensions(url, callback)
			{
				let elm = document.createElement("video");
				elm.src = url;

				elm.addEventListener("loadedmetadata", () => {
					callback(elm.videoWidth, elm.videoHeight);
					this._el_test.removeChild(elm);
				});
				elm.addEventListener("error", (e) => {
					console.warn(e);
				});

				this._el_test.appendChild(elm);
			}

			_createTag(text)
			{
				let tag = document.createElement("li");
				addClasses(tag, cl_tag);

				let textNode = document.createTextNode(text);
				tag.appendChild(textNode);

				return tag;
			}

			_createCopySVG(url)
			{
				let svg = this._createSVG("#icon-copy");
				addClasses(svg, cl_copyBtn);

				svg.addEventListener("click", (event) => {
					event.stopPropagation();
					this._copyToClipboard(url);
				});

				return svg;
			}

			_createDownloadSVG(url)
			{
				let svg = this._createSVG("#icon-download");
				addClasses(svg, cl_downloadBtn);

				svg.addEventListener("click", () => {
					event.stopPropagation();
					this._download(url);
				});

				return svg;
			}

			_createSVG(href)
			{
				let svg = document.createElementNS(SVGNS, "svg");
				addClasses(svg, cl_svg);

				let use = document.createElementNS(SVGNS, "use");
				use.setAttributeNS(XLINKNS,"href", href);
				svg.appendChild(use);

				return svg;
			}

			_copyToClipboard(text)
			{
				let elm = document.createElement("textarea");
				elm.value = text;
				elm.setAttribute('readonly', '');
				elm.style.position = 'absolute';
				elm.style.left = '-9999px';

				document.body.appendChild(elm);

				elm.select();
				document.execCommand("copy");

				document.body.removeChild(elm);
			}

			_download(url)
			{
				chrome.downloads.download({url: url});
			}
		};
	}).call(this);

	this.AutoComplete = (function(){

		const cl_hide = "noshow";
		const cl_li = [ "save-menu__auto-complete-li", "theme" ];
		const cl_activeLi = "active";

		const g_evaluate = (b, s) => { return shortestMatch(b, s, true); };

		return class {
			constructor(input, list, values, onConfirm)
			{
				this._el_input = input;
				this._el_list = list;
				this._values = values;
				this._onConfirm = onConfirm;

				this._attachEvents();
				this._close();
			}

			get prevSelected()
			{
				return this._prevSelected;
			}

			get selected()
			{
				return this._el_selected;
			}

			set selected(elm)
			{
				if (this._el_selected)
				{
					this._el_selected.classList.remove(cl_activeLi);
					this._prevSelected = this._el_selected.innerText;
				}
				else
				{
					this._prevSelected = null;
				}

				if (elm)
				{
					elm.classList.add(cl_activeLi);
				}
				this._el_selected = elm;
			}

			_update(text)
			{
				if (!text)
				{
					this._close();
				}
				else
				{
					let newValues = this._getSimilarValues(text, g_evaluate);
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

			_scroll(inward)
			{
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
					if (this.selected.previousSibling)
						{
							this.selected = this.selected.previousSibling;
						}
						else
						{
							this.selected = null;
						}
				}
				else
				{
					this.selected = this._el_list.firstChild;
				}
			}

			_confirm(value)
			{
				if (value)
				{
					this._el_input.value = value;
				}

				this._onConfirm();
				this._close();
			}

			_attachEvents()
			{
				this._el_input.addEventListener("input", (evt) => {
					this._update(this._el_input.value);
				});
				this._el_input.addEventListener("blur", (evt) => {
					this._close();
				});

				this._el_input.addEventListener("keydown", (evt) => {
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

			_getSimilarValues(text, comp)
			{
				let cache = {};
				for (let i = 0, l = this._values.length; i < l; i+=1)
				{
					let sim = comp(this._values[i], text);
					cache[this._values[i]] = sim;
				}

				let similarValues = this._values.slice();
				similarValues = similarValues.filter((s) => {
					return cache[s] !== null;
				});
				similarValues = similarValues.sort((s1, s2) => {
					return cache[s2] - cache[s1];
				});

				return similarValues;
			}

			_setList(newValues)
			{
				this._clearList();

				newValues.forEach((value) => {
					let li = this._createListElement(value);
					this._el_list.appendChild(li);

					if (!this.selected)
					{
						if (li.innerText === this.prevSelected)
						{
							this.selected = li;
						}
					}
				});
			}

			_createListElement(text)
			{
				let li = document.createElement("li");
				addClasses(li, cl_li);

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

				let textNode = document.createTextNode(text);
				li.appendChild(textNode);

				return li;
			}

			_clearList()
			{
				this.selected = null;

				let child = this._el_list.firstChild;
				while (child)
				{
					this._el_list.removeChild(child);
					child = this._el_list.firstChild;
				}
			}

			_isOpen()
			{
				return !this._el_list.classList.contains(cl_hide);
			}

			_show()
			{
				if (this._el_list.classList.contains(cl_hide))
				{
					this._el_list.classList.remove(cl_hide);
				}
			}

			_hide()
			{
				if (!this._el_list.classList.contains(cl_hide))
				{
					this._el_list.classList.add(cl_hide);
				}
			}

			_close()
			{
				this._hide();
				this._clearList();
			}
		};

		function timesFound(bigString, smallString)
		{
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

			if (count === 0) return null;
			else return count;
		}

		function shortestMatch(bigString, smallString, includeSameString)
		{
			let found = bigString.indexOf(smallString);

			if (found !== 0)
			{
				return null;
			}
			else
			{
				let val = smallString.length - bigString.length;
				if (!includeSameString && val === 0)
				{
					return null;
				}
				else
				{
					return val;
				}
			}
		}
	}).call(this);
}).call(Widgets);
