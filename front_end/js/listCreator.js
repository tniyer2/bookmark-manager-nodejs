
(function(){
	const DEFAULTS = { showDimensions: true,
					   showExtension: true, 
					   copy: true,
					   download: true };

	this.ListCreator = class{
		constructor()
		{
			this.test = document.createElement("canvas");
		}

		createList(srcUrl, category, title, options)
		{
			options = this._extend(options);

			let li = document.createElement("li");
			li.classList.add("sourceMenu__list__element");

			let filenameTextNode = document.createTextNode(title);
			/*
			let p = document.createElement("p");
			p.classList.add("sourceMenu__title");
			p.appendChild(filenameTextNode);
			li.appendChild(p);*/
			li.appendChild(filenameTextNode);

			let tags = document.createElement("ul");
			tags.classList.add("sourceMenu__tags");
			li.appendChild(tags);

			if (options.showExtension)
			{
				let arr = parseFileName(srcUrl, true);
				let ext = arr ? arr[1].substring(1) : null;
				if (ext)
				{
					let tag = this._addTag(ext);
					tags.appendChild(tag);
				}
			}

			if (options.showDimensions === true)
			{
				if (category === "image")
				{
					this._testImageDimensions(srcUrl, (w, h) => {
						console.log(`image loaded (${w}, ${h}):`, srcUrl);
						let tag = this._addTag(w + "x" + h);
						tags.appendChild(tag);
					});
				}
				else if (category === "video")
				{
					this._testVideoDimensions(srcUrl, (w, h) => {
						console.log(`video loaded (${w}, ${h}):`, srcUrl);
						let tag = this._addTag(h + "p");
						tags.appendChild(tag);
					});
				}
				else
				{
					let e = "category should not be " + category;
					throw Error(e);
				}
			}

			if (options.copy)
			{
				let svg = this._addSvg("#icon-copy");
				svg.classList.add("sourceMenu__copy");

				svg.addEventListener("click", (event) => {
					event.stopPropagation();

					this._copyToClipboard(srcUrl);
				});
				li.appendChild(svg);
			}

			if (options.download)
			{
				let svg = this._addSvg("#icon-download");
				svg.classList.add("sourceMenu__download");

				svg.addEventListener("click", () => {
					event.stopPropagation();

					chrome.downloads.download({url: srcUrl});
				});
				li.appendChild(svg);
			}

			return li;
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

		_addTag(text)
		{
			let pixelTag = document.createElement("li");
			pixelTag.classList.add("sourceMenu__tag");

			let textNode = document.createTextNode(text);
			pixelTag.appendChild(textNode);

			return pixelTag;
		}

		_addSvg(href)
		{
			let svgns = "http://www.w3.org/2000/svg";
			let xlinkns = "http://www.w3.org/1999/xlink";

			let svg = document.createElementNS(svgns, "svg");
			svg.classList.add("sourceMenu__svg");
			let use = document.createElementNS(svgns, "use");
			use.setAttributeNS(xlinkns,"href", href);
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
	}

}).call(this);
