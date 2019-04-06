
(function(){

	this.noop = function(){}; // eslint-disable-line no-empty-function

	this.isUdf = function(arg) {
		return typeof arg === "undefined";
	};

	this.makeTag = function() {
		let tag = "";
		for (let i = 0, l = arguments.length; i < l; i+=1)
		{
			tag += arguments[i];
		}
		tag += new Date().getTime();
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
	this.injectCss = function (element, chromeUrl) {

		let link  = document.createElement("link");
		link.rel  = "stylesheet";
		link.type = "text/css";
		link.href = chrome.runtime.getURL(chromeUrl);
		element.appendChild(link);
	};

	// Applies css classes to an element.
	// @param classes can be an array of strings or a string.
	this.addClasses = function(element, classes) {
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

	// @return index of content with contentId
	// @throws {error}, {badQuery}
	this.searchId = function(meta, contentId) {
		let index = meta.findIndex((m) => {
			return m.id === contentId;
		})

		if (index === -1)
		{
			let e = `Could not find content with id: '${contentId}'`;
			throw new Error(e);
		}
		else
		{
			return index;
		}
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

		increment(key)
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

		decrement(key)
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
