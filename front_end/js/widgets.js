
const Widgets = {};
(function(){
	const self = this;
	const SVGNS   = "http://www.w3.org/2000/svg";
	const XLINKNS = "http://www.w3.org/1999/xlink";

	this.onKeyDown = function(elm, key, callback) {
		elm.addEventListener("keydown", (evt) => {
			if (evt.key === key)
			{
				callback(evt);
			}
		});
	};

	this.prependBEMBlock = function(classObject, block) {
		if (block)
		{
			for (let key in classObject)
			{
				classObject[key] = block + "__" + classObject[key];
			}
		}
	};

	this.AwesomeFocus = class {
		constructor(focusCallback, blurCallback, options)
		{
			if (options.target)
			{
				this._mouseTarget = options.target;
				this._focusTarget = options.target;
			}
			else
			{
				this._mouseTarget = options.mouseTarget;
				this._focusTarget = options.focusTarget;
			}

			this._focusCallback = focusCallback;
			this._blurCallback = blurCallback;

			this._onfocus = (function(){
				this._removeMouse();
			}).bind(this);
			this._onblur = (function(){
				this._listenMouse();
				this._blurCallback();
			}).bind(this);

			if (options.disable !== true)
			{
				this.enable();
			}
		}

		enable()
		{
			this._listenMouse();
			this._listenFocus();
		}

		disable()
		{
			this._removeMouse();
			this._removeFocus();
		}

		_listenFocus()
		{
			this._focusTarget.addEventListener("focus", this._onfocus);
			this._focusTarget.addEventListener("blur", this._onblur);
		}

		_removeFocus()
		{
			this._focusTarget.removeEventListener("focus", this._onfocus);
			this._focusTarget.removeEventListener("blur", this._onblur);
		}

		_listenMouse()
		{
			this._mouseTarget.addEventListener("mouseenter", this._focusCallback);
			this._mouseTarget.addEventListener("mouseleave", this._blurCallback);
		}

		_removeMouse()
		{
			this._mouseTarget.removeEventListener("mouseenter", this._focusCallback);
			this._mouseTarget.removeEventListener("mouseleave", this._blurCallback);
		}
	};

	this.styleOnFocus = function(elm, cl, options) {
		return new self.AwesomeFocus(() => {
			addClass(elm, cl);
		}, () => {
			removeClass(elm, cl);
		}, options);
	};

	this.createSVG = function(href) {
		let svg = document.createElementNS(SVGNS, "svg");
		let use = document.createElementNS(SVGNS, "use");
		use.setAttributeNS(XLINKNS,"href", href);
		svg.appendChild(use);

		return svg;
	};

	this.DOMQueue = class {
		constructor(el_parent)
		{
			this._el_parent = el_parent;
			this._count = 0;
		}

		get count()
		{
			return this._count;
		}

		next()
		{
			let insert = this._insert.bind(this, this._count);
			this._count += 1;
			return insert;
		}

		_insert(order, elm)
		{
			let index = 0;
			let len = this._el_parent.childNodes.length;
			for (let i = 0; i < len; i+=1)
			{
				let c = this._el_parent.childNodes[i];
				if (!c.dataset || !("order" in c.dataset) || order > c.dataset.order)
				{
					index +=1;
				}
				else
				{
					break;
				}
			}

			elm.dataset.order = order;
			if (index === len)
			{
				this._el_parent.appendChild(elm);
			}
			else
			{
				let child = this._el_parent.childNodes[index];
				this._el_parent.insertBefore(elm, child);
			}
		}
	};

	this.AwesomeAlerter = function(){

		const cl_hide = "noshow";
		const cl_fadeIn = "fade-in";
		const cl_fadeOut = "fade-out";
		const listStyle = `position: absolute;
						   display: flex;
						   justify-content: space-between;`;
		const CLASSES = { list: "list",
						  li: "alert",
						  text: "text",
						  closeButton: "close" };

		const DEFAULTS = { BEMBlock: "",
						   spacing: 10,
						   stack: true,
						   limit: 10, 
						   insertAtTop: false };

		const AlertController = class {
			constructor()
			{
				this._functions = arguments;
			}

			get remove()
			{
				return this._functions[0];
			}

			get removeImmediately()
			{
				return this._functions[1];
			}
		};

		return class {
			constructor(parentElement, options)
			{
				this._options = extend(DEFAULTS, options);
				self.prependBEMBlock(CLASSES, this._options.BEMBlock);

				this._height = 0;

				this._list = this._createList();
				parentElement.appendChild(this._list);
			}

			get list() 
			{
				return this._list;
			}

			alert(text, duration)
			{
				let li = this._createLi(text);

				let overLimit = this._list.childNodes.length === this._options.limit;
				if (!this._options.stack || overLimit)
				{
					this._removeOnTransition(this._list.firstChild);
				}

				this._add(li);

				if (duration)
				{
					if (duration <= 0)
					{
						this._remove(li);
					}
					else
					{					
						setTimeout(() => {
							this._removeOnTransition(li);
						}, duration * 1000);
					};
				}
				return new AlertController(
					this._removeOnTransition.bind(this, li), 
					this._remove.bind(this, li));
			}

			_createList()
			{
				let list = document.createElement("ul");
				list.classList.add(CLASSES.list);
				list.classList.add(cl_hide);
				list.style = listStyle;

				let dir = this._options.insertAtTop ? "column-reverse": "column";
				let translateY = this._options.insertAtTop ? "0": "-100%";

				list.style.flexDirection = dir;
				list.style.transform = "translate(-50%, " + translateY + ")";

				return list;
			}

			_createLi(text)
			{
				let li = document.createElement("li");
				li.classList.add(CLASSES.li);

				let p = document.createElement("p");
				p.classList.add(CLASSES.text);
				let textNode = document.createTextNode(text);
				p.appendChild(textNode);
				li.appendChild(p);

				let closeButton = document.createElement("button");
				closeButton.classList.add(CLASSES.closeButton);
				closeButton.innerHTML = "&times;";
				closeButton.addEventListener("click", () => {
					this._removeOnTransition(li);
				});
				li.appendChild(closeButton);

				return li;
			}

			_add(li)
			{
				removeClass(this._list, cl_hide);
				this._list.append(li);
				this._updateHeight(li.clientHeight);
				li.classList.add(cl_fadeIn);
			}

			_removeOnTransition(li)
			{
				if (li && this._list.contains(li))
				{
					li.addEventListener("transitionend", (evt) => {
						this._remove(li);
					});
					li.classList.add(cl_fadeOut);
				}
			}
			
			_remove(li)
			{
				if (li && this._list.contains(li))
				{
					let height = li.clientHeight;
					this._list.removeChild(li);
					this._updateHeight(-1 * height);

					if (this._list.childNodes.length === 0)
					{
						addClass(this._list, cl_hide);
					}
				}
			}

			_updateHeight(itemHeight)
			{
				this._height += itemHeight;
				let numOfItems = this._list.childNodes.length;
				let spacing = Math.max(numOfItems - 1, 0) * this._options.spacing;
				let final = Math.max(this._height + spacing, 0);
				if (numOfItems === 1)
				{
					// An extra pixel stops annoying flexbox behavior
					final += 1;
				}

				this._list.style.height = final + "px";
			}
		};
	}();

	this.ListManager = function(){

		const cl_activeSource = "active";
		const CLASSES = { sourceList: "list",
						  source: "source",
						  tagList: "tag-list",
						  tag: "tag",
						  text: "text",
						  linkBtn: "link",
						  downloadBtn: "download",
						  svg: "svg" };

		const CLASS_DEFAULTS = { BEMBlock: "",
								 selectFirst: true,
								 // @param li selected element
								 // @param data data associated with the element
								 onSelect: noop,
								 // same signature
								 onDeselect: noop };
		const SOURCE_DEFAULTS = { createLink: true,
								  allowDownload: true,
								  type: "",
								  showDimensions: false,
								  showExtension: true,
								  title: "source",
								  data: null };

		return class {
			constructor(el_parent, options)
			{
				this._options = extend(CLASS_DEFAULTS, options);
				self.prependBEMBlock(CLASSES, this._options.BEMBlock);

				this._data = [];

				this._el_list = document.createElement("ul");
				this._el_list.classList.add(CLASSES.sourceList);
				el_parent.appendChild(this._el_list);
				this._el_test = document.createElement("canvas");

				this._queue = new self.DOMQueue(this._el_list);
			}

			get el_list()
			{
				return this._el_list;
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

			async addSource(srcUrl, sourceOptions)
			{
				let insertSource = this._queue.next();

				sourceOptions = extend(SOURCE_DEFAULTS, sourceOptions);

				const el_source = document.createElement("li");
				el_source.classList.add(CLASSES.source);

				const p = document.createElement("p");
				p.classList.add(CLASSES.text);
				const titleTextNode = document.createTextNode(sourceOptions.title);
				p.appendChild(titleTextNode)
				el_source.appendChild(p);

				const el_tagList = document.createElement("ul");
				el_tagList.classList.add(CLASSES.tagList);
				el_source.appendChild(el_tagList);

				if (sourceOptions.showExtension === true)
				{
					let tag = this._createExtensionTag(srcUrl);
					if (tag)
					{
						el_tagList.appendChild(tag);
					}
				}

				let sourceMeta;
				if (sourceOptions.type === "image")
				{
					try
					{
						sourceMeta = await bindWrap(this._testImageDimensions, 
									   		  		this, srcUrl);
						sourceMeta.text = sourceMeta.width + "x" + sourceMeta.height;
					}
					catch (e) {/*ignore*/}
				}
				else if (sourceOptions.type === "video")
				{
					try
					{
						sourceMeta = await bindWrap(this._testVideoDimensions, 
											  		this, srcUrl);
						sourceMeta.text = sourceMeta.height + "p";
					}
					catch (e) {/*ignore*/}
				}
				else 
				{
					console.warn("sourceOptions.type is not 'image' or 'video':", 
								 sourceOptions.type);
				}

				if (!isUdf(sourceMeta))
				{
					sourceOptions.data.sourceMeta = sourceMeta;
					if (sourceOptions.showDimensions === true)
					{
						let tag = this._createTag(sourceMeta.text);
						el_tagList.appendChild(tag);
					}
				}

				if (sourceOptions.createLink === true)
				{
					let linkBtn = this._createLinkSVG(srcUrl);
					el_source.appendChild(linkBtn);
				}

				if (sourceOptions.allowDownload === true)
				{
					let downloadBtn = this._createDownloadSVG(srcUrl);
					el_source.appendChild(downloadBtn);
				}

				let selectedData = {li: el_source, data: sourceOptions.data};
				if (this._options.selectFirst === true && !this.selected)
				{
					this.selected = selectedData;
				}

				el_source.addEventListener("click", () => {
					this.selected = selectedData;
				});

				insertSource(el_source);
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

			_testImageDimensions(url, successCallback, errorCallback)
			{
				let elm = document.createElement("img");
				elm.src = url;

				elm.addEventListener("load", () => {
					let info = { width: elm.naturalWidth, 
								 height: elm.naturalHeight };
					successCallback(info);
					this._el_test.removeChild(elm);
				});
				elm.addEventListener("error", () => {
					errorCallback(null);
				}, true);

				this._el_test.appendChild(elm);
			}

			_testVideoDimensions(url, successCallback, errorCallback)
			{
				let elm = document.createElement("video");
				elm.src = url;

				elm.addEventListener("loadedmetadata", () => {
					let info = { width: elm.videoWidth, 
								 height: elm.videoHeight,
								 duration: elm.duration };
					successCallback(info);
					this._el_test.removeChild(elm);
				});
				elm.addEventListener("error", () => {
					errorCallback(null);
				}, true);

				this._el_test.appendChild(elm);
			}

			_createTag(text)
			{
				let tag = document.createElement("li");
				tag.classList.add(CLASSES.tag);

				let textNode = document.createTextNode(text);
				tag.appendChild(textNode);

				return tag;
			}

			_createLinkSVG(url)
			{
				let svg = self.createSVG("#icon-link");
				svg.classList.add(CLASSES.svg);
				svg.classList.add(CLASSES.linkBtn);

				svg.addEventListener("click", (event) => {
					event.stopPropagation();
				});

				let a = document.createElement("a");
				a.href = url;
				a.target = "_blank";
				a.appendChild(svg);

				return a;
			}

			_createDownloadSVG(url)
			{
				let svg = self.createSVG("#icon-download");
				svg.classList.add(CLASSES.svg);
				svg.classList.add(CLASSES.downloadBtn);

				svg.addEventListener("click", () => {
					event.stopPropagation();
					this._download(url);
				});

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
	}();

	this.AutoComplete = function(){

		const g_evaluate = (b, s) => { return shortestMatch(b, s, true); };

		const cl_hide = "noshow";
		const cl_activeLi = "active";
		const CLASSES = { autoComplete: "auto-complete", 
						  li: "auto-complete-li" };
		const DEFAULTS = { BEMBlock: "", 
						   values: [], 
						   onConfirm: noop, 
						   caseSensitive: false };
		const IGNORE_MODIFIERS = ["*", "!"];

		return class {
			constructor(input, parentElement, options)
			{
				this._options = extend(DEFAULTS, options);
				self.prependBEMBlock(CLASSES, this._options.BEMBlock)

				this._el_input = input;
				this._el_list = document.createElement("ul");
				this._el_list.classList.add(CLASSES.autoComplete);
				parentElement.appendChild(this._el_list);

				this._attachEvents();
				this._close();
			}

			get el_list()
			{
				return this._el_list;
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
					elm.scrollIntoView({block: "nearest"});
				}
				this._el_selected = elm;
			}

			_update(text)
			{
				let formatted = this._formatInput(text);
				this._inputText = formatted.text;
				this._modifier = formatted.modifier;

				if (!this._inputText)
				{
					this._close();
				}
				else
				{
					let newValues = this._getSimilarValues(this._inputText, g_evaluate);
					if (newValues.length > 0)
					{
						this._setList(newValues);
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
					if (inward && this.selected.nextSibling)
					{
						this.selected = this.selected.nextSibling;
					}
					else if (!inward && this.selected.previousSibling)
					{
						this.selected = this.selected.previousSibling;
					}
					else {/*ignore*/}
				}
				else if (inward)
				{
					this.selected = this._el_list.firstChild;	
				}
				else {/*ignore*/}
			}

			_confirm(value)
			{
				if (value)
				{
					this._el_input.value = this._modifier + value;
				}

				this._options.onConfirm();
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

				self.onKeyDown(this._el_input, "ArrowUp", (evt) => {
					evt.preventDefault();
					this._scroll(false);
				});
				self.onKeyDown(this._el_input, "ArrowDown", (evt) => {
					evt.preventDefault();
					this._scroll(true);
				});
				self.onKeyDown(this._el_input, "Enter", (evt) => {
					let val = this._isOpen() && this.selected ? 
							  this.selected.innerText : null;
					this._confirm(val);
				});
			}

			_formatInput(text)
			{
				if (!text)
				{
					return text;
				}

				if (!this._options.caseSensitive)
				{
					text = text.toLowerCase();
				}

				let modifier = "";
				for (let m of IGNORE_MODIFIERS)
				{
					if (text.charAt(0) === m)
					{
						modifier = m;
						text = text.substring(1);
						break;
					}
				}

				return {text: text, modifier: modifier};
			}

			_getSimilarValues(text, comp)
			{
				let cache = {};
				for (let i = 0, l = this._options.values.length; i < l; i+=1)
				{
					let sim = comp(this._options.values[i], text);
					cache[this._options.values[i]] = sim;
				}

				let similarValues = this._options.values.slice();
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

				this._show();
			}

			_createListElement(text)
			{
				let li = document.createElement("li");
				li.classList.add(CLASSES.li);

				li.addEventListener("mousemove", () => {
					if (this.selected !== li)
					{
						this.selected = li;
					}
				});
				li.addEventListener("click", (evt) => {
					evt.preventDefault();
					this._confirm(text);
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
	}();
}).call(Widgets);
