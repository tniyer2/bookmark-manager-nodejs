
(function(){

	this.noop = function(){}; // eslint-disable-line no-empty-function

	this.isUdf = function(arg) {
		return typeof arg === "undefined";
	};

	this.clamp = function(val, low, high) {
		return Math.min(Math.max(val, low), high);
	}

	this.makeTag = function() {
		let tag = Array.from(arguments).join("-");
		tag += "-" + Date.now();
		return tag;
	};

	const alphaNumeric = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
	this.getRandomString = function(len) {
		let s = "";
		let anLen = alphaNumeric.length;
		for (let i = 0; i < len; i+=1)
		{
			let rand = Math.floor(Math.random() * anLen);
			s += alphaNumeric.charAt(rand);
		}

		return s;
	};

	this.removeDuplicates = function(arr, sortMethod) {
		arr.sort(sortMethod);
		for (let i = arr.length - 1; i >= 0; i-=1)
		{
			if (arr[i] === arr[i-1])
			{
				arr.splice(i, 1);
			}
		}
		return arr;
	};

	// Wraps a function in a Promise
	this.wrap = function(f, ...args) {

		return new Promise((resolve, reject) => {
			f(...args, response => resolve(response),
					   error => reject(error));
		});
	};

	// Binds a function to an object and then wraps in a Promise
	this.bindWrap = function(f, me, ...args) {

		f = f.bind(me);

		return new Promise((resolve, reject) => {
			f(...args, response => resolve(response),
					   error => reject(error));
		});
	};

	this.bindAll = function(me, ...funcs) {
		let bound = [];
		funcs.forEach((f) => {
			bound.push(f.bind(me));
		});
		return bound;
	};

	// Combines the keys of multiple objects into one object.
	// @param the objects.
	// @returns an object with the combined keys.
	this.extend = function() {

        var master = {};
        for (var i = 0, l = arguments.length; i < l; i+=1) {
            var object = arguments[i];
            for (var key in object) {
                if (object.hasOwnProperty(key)) {
                    master[key] = object[key];
                }
            }
        }

        return master;
    };

    // @param element the element to append the <link> to.
    // @param chromeUrl the url of the css in the chrome extension.
	this.injectCss = function(element, chromeUrl) {

		let link  = document.createElement("link");
		link.rel  = "stylesheet";
		link.type = "text/css";
		link.href = chrome.runtime.getURL(chromeUrl);
		element.appendChild(link);
	};

	this.injectThemeCss = function(theme, cssNames) {
		for (let i = 0, l = cssNames.length; i < l; i+=1)
		{
			let css = cssNames[i];
			let url = "css/" + css + "-theme-" + theme + ".css";
			injectCss(document.head, url);
		}
	};

	this.addClass = function(element, classname) {
		if (!element.classList.contains(classname))
		{
			element.classList.add(classname);
		}
	};

	this.removeClass = function(element, classname) {
		if (element.classList.contains(classname))
		{
			element.classList.remove(classname);
		}
	};

	// Parses a filepath from a url.
	// @return the filepath or [filename, ext] if split is true.
	this.parseFileName = function(pathname, split) {

		const rgx = /\w+(?:\.\w{3,4})+(?!.+\w+(?:\.\w{3,4})+)/;
		let matches = pathname.match(rgx);

		if (matches && matches.length > 0)
		{
			let match = matches[0];

			if (split)
			{
				let p = match.lastIndexOf(".");
				return [match.substring(0, p), match.substring(p)];
			}
			else
			{
				return match;
			}
		}
		else
		{
			return null;
		}
	};

	this.searchId = function(meta, id) {

		let i = meta.findIndex((m) => m.id === id);
		let content = meta[i];

		let final = content ? {index: i, content: content} : {index: null, content: null};
		return final;
	};

	// Keeps track of how many times a tag exists.
	this.TagCounter = class{
		constructor()
		{
			this._master = {};
		}

		get tags()
		{
			return Object.keys(this._master);
		}

		increment(keys)
		{
			keys.forEach((k) => {
				this._increment(k);
			});
		}

		decrement(keys)
		{
			keys.forEach((k) => {
				this._decrement(k);
			});
		}

		_increment(key)
		{
			if (!this._master.hasOwnProperty(key))
			{
				this._master[key] = 1;
			}
			else
			{
				this._master[key] += 1;
			}
		}

		_decrement(key)
		{
			if (this._master.hasOwnProperty(key))
			{
				let val = this._master[key];
				if (val === 1)
				{
					delete this._master[key];
				}
				else
				{
					this._master[key] -= 1;
				}
			}
		}
	};
}).call(this);
