
(function(){
	const STRING_KEYS = ["id", "title", "category", "srcUrl", "docUrl"];
	const NUMBER_KEYS = ["date", "bytes"];

	const SEND_RAW = "all";
	const SEARCH_TOLERANCE = 70;

	const CASE_WEIGHT = 0.1;
	const FOUND_AT_END_WEIGHT = 0.3;
	const FOUND_IN_MIDDLE_WEIGHT = 0.85;

	function query(meta, q)
	{
		if (q === SEND_RAW) return meta;

		let map = parseQuery(q);
		let filter = genFilter(map);
		let sortInfo = genComparator(map);

		if (filter)
		{
			meta = meta.filter(filter);
		}

		if (map.title)
		{
			meta = search(meta, map.title[0]);
		}

		if (sortInfo)
		{
			meta.sort(sortInfo.compare);

			if (sortInfo.reverse)
			{
				meta.reverse();
			}
		}

		return meta;
	}

	function parseQuery(q)
	{
		let map = {};
		for (let keyPair of q.split("&"))
		{
			arr = keyPair.split("=");
			if (arr.length !== 2)
			{
				throw "'" + keyPair + "' could not be parsed into key and values.";
			}
			let key = arr[0];
			let values = arr[1].split("+");

			map[key] = values;
		}

		return map;
	}

	function genFilter(map)
	{
		let filter;

		for (let key in map)
		{
			if (key === "title" || key === "asc" || key === "dsc") continue;

			let getFilter = key === "tags"  ? getTagFilter :
							STRING_KEYS.find(element => key === String(element)) ? getStringFilter :
							NUMBER_KEYS.find(element => key === String(element)) ? getNumberFilter :
							null;

			if (getFilter === null)
			{
				throw "key '" + key + "' is unsupported.";
			}

			let subFilters = [];
			for (let value of map[key])
			{
				let f = getFilter(key, value);
				subFilters.push(f);
			}

			filter = (obj) => {
				for (let f of subFilters)
				{
					if (!f(obj)) 
					{
						return false;
					}
				}
				return true;
			};
		}

		return filter;
	}

	function genComparator(map)
	{
		let sortInfo = {};
		let sortKey = map.asc ? map.asc : map.dsc;

		if (!sortKey || (sortKey === "title" && map[sortKey]))
		{
			return null;
		}

		sortInfo.reverse = Boolean(map.dsc);

		if (STRING_KEYS.find(element => sortKey === String(element)))
		{
			sortInfo.compare = (first, second) => {
				return first[sortKey].localeCompare(second[sortKey]);
			};
		}
		else if (NUMBER_KEYS.find(element => sortKey === String(element)))
		{
			sortInfo.compare = (first, second) => {
				return first[sortKey] - second[sortKey];
			};
		}
		else
		{
			throw "sortKey '" + sortKey + "' is not supported.";
		}

		return sortInfo;
	}

	function search(meta, q)
	{
		ratios = {};
		for (let elm of meta)
		{
			ratios[elm.id] = ratio(q, elm.title);
		}

		meta.sort((first, second) =>
			ratios[second.id] - ratios[first.id]
		);

		meta = meta.filter(obj => ratios[obj.id] > SEARCH_TOLERANCE);

		return meta;
	}

	function getTagFilter(key, value)
	{
		let not = false;
		let first = value.substring(0, 1);

		if (first === "!")
		{
			not = true;
			value = value.substring(1);
		}

		let f = (obj) => {
			let b = Boolean(obj[key].find(tag => String(tag) === value));
			return not ? !b : b;
		};

		return f;
	}

	function getStringFilter(key, value)
	{
		let f = value.substring(0, 1) === "!" ?
				obj => obj[key] !== value.substring(1) :
				obj => obj[key] === value;

		return f;
	}

	function getNumberFilter(key, value)
	{
		value = Number(value);

		let f =
		value.substring(0, 1) === "!"  ? obj => obj[key] != Number(value.substring(1)) :
		value.substring(0, 1) === ">"  ? obj => obj[key] > Number(value.substring(1)) :
		value.substring(0, 1) === "<"  ? obj => obj[key] < Number(value.substring(1)) :
		value.substring(0, 2) === "x>" ? obj => obj[key] >= Number(value.substring(2)) :
		value.substring(0, 2) === "x<" ? obj => obj[key] <= Number(value.substring(2)) :
		obj => value === obj[key];

		return f;
	}

	function getId(meta, id)
	{
		for (let i = 0; i < meta.length; i+=1)
		{
			if (meta[i].id === id) return i;
		}
	}

	function ratio(x, y)
	{
		// console.log("title: " + x);
		// console.log("query: " + y);

		let split = s => s.split(/\s/).filter(i => i);
		let xterms = split(x);
		let yterms = split(y);

		let sorted = [];
		let sortedIndex = [];
		for (let i = 0; i < xterms.length; i+=1)
		{
			sorted[i] = [];
			sortedIndex[i] = [];
			for (let j = 0; j < yterms.length; j+=1)
			{
				let distance = isInside(xterms[i], yterms[j]);
				if (distance === false)
				{
					distance = calcDistance(xterms[i], yterms[j]);
				}

				let insertedAt = binaryInsert(sorted[i], distance);
				sortedIndex[i].splice(insertedAt, 0, j);
			}
		}

		// console.log(sorted);
		// console.log(sortedIndex);

		let totalCharacters = 0;
		let totalDistance = 0;

		for (let i = 0; i < sorted.length; i+=1)
		{
			totalDistance += sorted[i][0];
			totalCharacters += yterms[sortedIndex[i][0]].length;
		}

		let percentage = (totalCharacters - totalDistance) / totalCharacters * 100;
		// console.log("ratio: " + Math.round(percentage) + "%");
		return percentage;
	}

	function isInside (x, y)
	{
		if (x.length === y.length) return false;

		// y should be the smaller string
		if (y.length > x.length)
		{
			let temp = x;
			x = y;
			y = temp;
		}

		let i = x.indexOf(y);
		let score;
		if (i === -1)
		{
			score = false;
		}
		else if (i === 0 || x.length === y.length + i)
		{
			score = (x.length - y.length) * FOUND_AT_END_WEIGHT;
		}
		else
		{
			score = (x.length - y.length) * FOUND_IN_MIDDLE_WEIGHT;
		}

		return score;
	}

	function calcDistance(x, y)
	{
	    let table = [];

	    for (let i = 0; i <= x.length + 1; i+=1)
		{
			table[i] = [];
	        for (let j = 0; j <= y.length + 1; j+=1)
	        {
	            if (i === 0)
	                table[i][j] = j;
	            else if (j === 0)
	                table[i][j] = i;
	            else
	            {
	                table[i][j] = Math.min(table[i - 1][j - 1]
	                 + cost(x.charAt(i - 1), y.charAt(j - 1)),
	                  table[i - 1][j] + 1,
	                  table[i][j - 1] + 1);
	            }
	        }
	    }

	    return table[x.length][y.length];
	}

	function cost(a, b)
	{
		return a === b ? 0 : a.toLowerCase() === b.toLowerCase() ? CASE_WEIGHT : 1;
	}

	function binaryInsert(arr, elm)
	{
		if (arr.length === 0)
		{
			arr.push(elm);
			return 0;
		}
		else if (arr.length === 1)
		{
			if (elm >= arr[0])
			{
				arr.push(elm);
				return 1;
			}
			else
			{
				arr.unshift(elm);
				return 0;
			}
		}

		let recurse = (low, up) => {

			if (up - low === 1)
			{
				if (elm >= arr[up])
				{
					arr.splice(up+1, 0, elm);
					return up+1;
				}
				else if (elm <= arr[low])
				{
					arr.splice(low, 0, elm);
					return low;
				}
				else
				{
					arr.splice(up, 0, elm);
					return up;
				}
			}

			let mid = Math.ceil((low + up) / 2);
			if (elm >= arr[mid])
			{
				return recurse(mid, up);
			}
			else if (elm < arr[mid])
			{
				return recurse(low, mid);
			}
		};

		return recurse(0, arr.length - 1);
	}

	function getRandomString()
	{
		const alphaNumeric = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
		const length = 40;

		let s = "";
		for (let i = 0; i < length; i+=1)
		{
			let rand = Math.floor(Math.random() * alphaNumeric.length);
			s += alphaNumeric.charAt(rand);
		}

		return s;
	}

	this.query = query;
	this.getId = getId;
	this.getRandomString = getRandomString;

}).call(this);
