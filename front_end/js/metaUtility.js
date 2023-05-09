
const getRandomString = (function(){
	const all = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

	return function(len) {
		let s = "";
		let allLen = all.length;
		for (let i = 0; i < len; i+=1)
		{
			let rand = Math.floor(Math.random() * allLen);
			s += all.charAt(rand);
		}
		return s;
	};
})();

const searchId = function(meta, id) {
	let i = meta.findIndex(m => m.id === id);
	let content = meta[i];

	if (content)
	{
		return {index: i, content: content};
	}
	else
	{
		return {index: null, content: null};
	}
};

const TagCounter = (function(){
	let proto = "__proto__";

	return class{
		constructor()
		{
			this._master = Object.create(null);
			this._protoCount = 0;
		}

		get tags()
		{
			let keys = Object.keys(this._master);
			if (this._protoCount > 0)
			{
				keys.push(proto);
			}
			return keys;
		}

		increment(keys)
		{
			keys.forEach(this._increment.bind(this));
		}

		decrement(keys)
		{
			keys.forEach(this._decrement.bind(this));
		}

		_increment(key)
		{
			if (key === proto)
			{
				this._protoCount += 1;
			}
			else if (!(key in this._master))
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
			if (key === proto)
			{
				if (this._protoCount > 0)
				{
					this._protoCount -= 1;
				} 
				else {/*ignore*/}
			}
			else if (key in this._master)
			{
				if (this._master[key] === 1)
				{
					delete this._master[key];
				}
				else
				{
					this._master[key] -= 1;
				}
			}
			else {/*ignore*/}
		}
	};
})();

export { getRandomString, searchId, TagCounter };
