
(function(){

	const SVGNS   = "http://www.w3.org/2000/svg";
	const XLINKNS = "http://www.w3.org/1999/xlink";

	const cl_source = "source-menu__source";
	const cl_tagList = "source-menu__tag-list";
	const cl_tag  = ["source-menu__tag", "source-menu__tag--theme"];
	const cl_copyBtn = "source-menu__copy";
	const cl_downloadBtn = "source-menu__download";
	const cl_svg  = ["source-menu__svg", "source-menu__svg--theme"];

	const g_noop = function(){};

	const DEFAULTS = { allowCopy: true,
					   allowDownload: true,
					   type: "",
					   // {param li} selected element 
					   onSelect: g_noop,
					   // {param li} deselected element 
					   onDeselect: g_noop,
					   showDimensions: false,
					   showExtension: true,
					   title: "source" };

	this.SourceList = class{
		constructor(list)
		{
			this.list = list;
			this.test = document.createElement("canvas");
		}

		addSourceElement(srcUrl, options)
		{
			options = this._extend(options);

			const sourceElement = document.createElement("li");
			this._addClasses(sourceElement, cl_source);

			const titleTextNode = document.createTextNode(options.title);
			sourceElement.appendChild(titleTextNode);

			const tagList = document.createElement("ul");
			this._addClasses(tagList, cl_tagList);
			sourceElement.appendChild(tagList);

			if (options.showExtension === true)
			{
				let tag = this._createExtensionTag(srcUrl);
				if (tag)
				{
					tagList.appendChild(tag);
				}
			}

			if (options.showDimensions === true)
			{
				(async () => {
					let tag = await bindWrap(this._createDimensionsTag, this, 
											 srcUrl, options.type);
					tagList.appendChild(tag);
				})();
			}

			if (options.allowCopy === true)
			{
				let copyBtn = this._createCopySVG(srcUrl);
				sourceElement.appendChild(copyBtn);
			}

			if (options.allowDownload === true)
			{
				let downloadBtn = this._createDownloadSVG(srcUrl);
				sourceElement.appendChild(downloadBtn);
			}

			if (!this.selected)
			{
				this.selected = sourceElement;
				options.onSelect(sourceElement);
			}
			sourceElement.addEventListener("click", () => {
				if (this.selected)
				{
					options.onDeselect(this.selected);
					this.selected = sourceElement;
				}

				options.onSelect(sourceElement);
			});

			this.list.appendChild(sourceElement);
			return sourceElement;
		}

		_createExtensionTag(url)
		{
			let arr = parseFileName(url, true);
			let ext = arr ? arr[1].substring(1) : null;

			if (ext)
			{
				let elm = this._createTag(ext) 
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

			elm.addEventListener("load", () => {
				callback(elm.naturalWidth, elm.naturalHeight);
				this.test.removeChild(elm);
			});
			elm.addEventListener("error", (e) => {
				console.warn(e);
			});

			this.test.appendChild(elm);
		}

		_testVideoDimensions(url, callback)
		{
			let elm = document.createElement("video");
			elm.src = url;

			elm.addEventListener("loadedmetadata", () => {
				callback(elm.videoWidth, elm.videoHeight);
				this.test.removeChild(elm);
			});
			elm.addEventListener("error", (e) => {
				console.warn(e);
			});

			this.test.appendChild(elm);
		}

		_createTag(text)
		{
			let tag = document.createElement("li");
			this._addClasses(tag, cl_tag);

			let textNode = document.createTextNode(text);
			tag.appendChild(textNode);

			return tag;
		}

		_createCopySVG(url)
		{
			let svg = this._createSVG("#icon-copy");
			this._addClasses(svg, cl_copyBtn);

			svg.addEventListener("click", (event) => {
				event.stopPropagation();
				this._copyToClipboard(url);
			});

			return svg;
		}

		_createDownloadSVG(url)
		{
			let svg = this._createSVG("#icon-download");
			this._addClasses(svg, cl_downloadBtn);

			svg.addEventListener("click", () => {
				event.stopPropagation();
				this._download(url);
			});

			return svg;
		}

		_createSVG(href)
		{
			let svg = document.createElementNS(SVGNS, "svg");
			this._addClasses(svg, cl_svg);

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

		_addClasses(element, classes)
		{
			if (typeof classes === "string")
			{
				element.classList.add(classes);
			}
			else
			{
				for (let i = 0, l = classes.length; i < l; i+=1)
				{
					element.classList.add(classes[i]);
				}
			}
		}

		_extend(options) 
		{
			let final = {};
			let all = [DEFAULTS, options];

			for (let obj of all)
			{
			    for (let key in obj) 
			    {
			        if (obj.hasOwnProperty(key)) 
			        {
			            final[key] = obj[key];
			        }
			    }
			}

			return final;
		}
	}
}).call(this);
