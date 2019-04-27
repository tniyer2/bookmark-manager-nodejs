
this.MetaUtility = new (function(){

	this.getRandomString = (function(){
		const alphaNumeric = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

		return function(len) {
			let s = "";
			let anLen = alphaNumeric.length;
			for (let i = 0; i < len; i+=1)
			{
				let rand = Math.floor(Math.random() * anLen);
				s += alphaNumeric.charAt(rand);
			}

			return s;
		};
	})();

	this.searchId = function(meta, id) {

		let i = meta.findIndex((m) => m.id === id);
		let content = meta[i];

		let final = content ? {index: i, content: content} : {index: null, content: null};
		return final;
	};

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
})();
