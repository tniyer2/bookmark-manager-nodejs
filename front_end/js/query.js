
(function(){

	const Ratio = (function(){
		const CASE_WEIGHT = 0.1;
		const FOUND_AT_END_WEIGHT = 0.3;
		const FOUND_IN_MIDDLE_WEIGHT = 0.85;

		// @return the ratio that match matches main;
		//		   0(inclusive) to 100(inclusive)
		return function(main, match) {

			if (!isString(main) || !isString(match))
			{
				throw new Error(`invalid params. main: ${main}, match: ${match}`);
			}
			else if ((!main && match) || (main && !match))
			{
				return 0;
			}
			else if (main === match)
			{
				return 100;
			}

			let split = s => s.split(/\s/).filter(o => o);
			let mainTokens = split(main);
			let matchTokens = split(match);

			let sorted = [];
			let sortedIndex = [];
			for (let i = 0, a = mainTokens.length; i < a; i+=1)
			{
				sorted[i] = [];
				sortedIndex[i] = [];
				for (let j = 0, b = matchTokens.length; j < b; j+=1)
				{
					let distance = isInside(mainTokens[i], matchTokens[j]);
					if (distance === false)
					{
						distance = calcDistance(mainTokens[i], matchTokens[j]);
					}

					let insertedAt = binaryInsert(sorted[i], distance);
					sortedIndex[i].splice(insertedAt, 0, j);
				}
			}

			let totalCharacters = 0;
			let totalDistance = 0;

			for (let i = 0, l = sorted.length; i < l; i+=1)
			{
				totalDistance += sorted[i][0];
				totalCharacters += matchTokens[sortedIndex[i][0]].length;
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

		function isString(x)
		{
	  		return Object.prototype.toString.call(x) === "[object String]";
		}
	}).call(this);

	this.Searcher = (function(){

		const TITLE_KEY = "title";
		const TAG_KEY = "tags";
		const SORT_KEY = "sort";

		const NO_FILTER_KEYS 	= [ TITLE_KEY ];
		const SINGLE_VALUE_KEYS = [ TITLE_KEY ];
		const STRING_KEYS 		= [ TITLE_KEY, "id", "category", "srcUrl", "docUrl" ];
		const NUMBER_KEYS 		= [ "date", "bytes" ];

		const NOT_MODIFIER = "!";
		const OR_MODIFIER = "*";

		const SEARCH_TOLERANCE = 70;

		this.prototype.query = function(meta, map) {

			let filter = getFilter(map);
			let sortMethods = [];

			if (filter)
			{
				meta = meta.filter(filter);
			}

			let title = map[TITLE_KEY];
			if (title)
			{
				let info = search(meta, title);
				meta = info.meta;
				sortMethods.push(info.sort);
			}

			let tags = map[TAG_KEY];
			if (tags)
			{
				let info = searchTags(meta, tags);
				meta = info.meta
				sortMethods.push(info.sort);
			}

			let sortKeys = map[SORT_KEY];
			if (sortKeys)
			{
				let moreSortMethods = getSort(sortKeys);
				sortMethods = sortMethods.concat(moreSortMethods);
			}

			if (sortMethods.length)
			{
				sort(meta, sortMethods);
			}

			return meta;
		};
		this.prototype.parse = function(q) {

			function split(arr, reg)
			{
				return arr.split(reg).filter(o => o);
			}

			let map = {};
			if (!q) return map;

			let options = split(q, "&");

			options.forEach((opt) => {
				let arr = opt.split("=");
				if (arr.length !== 2)
				{
					let e = "'" + opt + "' could not be parsed into a key and values.";
					throw new Error(e);
				}

				let key = arr[0];
				let values;
				if (SINGLE_VALUE_KEYS.includes(key))
				{
					values = decodeURIComponent(arr[1]);
				}
				else
				{
					values = split(arr[1], "+").map(s => decodeURIComponent(s));
				}

				map[key] = values;
			});

			return map;
		};
		return new this();

		function getFilter(map)
		{
			let filters = [];

			for (let key in map)
			{
				if (!map.hasOwnProperty(key)) continue;

				let factory;
				if (NO_FILTER_KEYS.includes(key))
				{
					continue;
				}
				else if (STRING_KEYS.includes(key))
				{
					factory = getStringFilter;
				}
				else if (NUMBER_KEYS.includes(key))
				{
					factory = getNumberFilter;
				}
				else
				{
					continue;
				}

				let f = factory(key, map[key]);
				filters.push(f);
			}

			return combineFilters(filters);
		}

		function getSort(sortKeys)
		{
			function inner(key)
			{
				let dsc = key.charAt(0) === NOT_MODIFIER;
				if (dsc)
				{
					key = key.substring(1);
				}

				let sort;
				if (STRING_KEYS.includes(key))
				{
					sort = (f, s) => f[key].localeCompare(s[key]);
				}
				else if (NUMBER_KEYS.includes(key))
				{
					sort = (f, s) => f[key] - s[key];
				}
				else
				{
					throw "'" + key + "' is not a supported sortkey.";
				}

				if (dsc)
				{
					return (f, s) => sort(s, f);
				}
				else
				{
					return sort;
				}
			}

			let sortMethods = [];
			sortKeys.forEach((key) => {
				sortMethods.push(inner(key));
			});
			return sortMethods
		}

		function search(meta, match)
		{
			ratios = {};
			meta.forEach((c) => {
				ratios[c.id] = Ratio(match, c.title);
			});

			meta = meta.filter((c) => {
				return ratios[c.id] > SEARCH_TOLERANCE;
			});

			let sort = (f, s) => ratios[s.id] - ratios[f.id];

			return {meta: meta, sort: sort};
		}

		function searchTags(meta, match)
		{
			let {whitelist, optional, blacklist} = parseModifiers(match);

			function evaluate(content)
			{
				let tags = content[TAG_KEY];

				let blFound = tags.find(tag => find(blacklist, tag));
				if (blFound) return 0;

				let count = 0;
				if (whitelist.length)
				{
					let wlMissing = whitelist.find(wl => !find(tags, wl));
					if (wlMissing) return 0;
					count += 1;
				}
				let found = tags.filter(tag => find(optional, tag));
				count += found.length;

				return count;
			}

			let cache = {};
			meta.forEach((content) => {
				cache[content.id] = evaluate(content);
			});

			meta = meta.filter(c => cache[c.id] !== 0);
			let sort = (f, s) => cache[s.id] - cache[f.id];

			return {meta: meta, sort: sort};
		}

		function getStringFilter(key, values)
		{
			let {whitelist, optional, blacklist} = parseModifiers(values);

			return (obj) => {
				let objectValue = obj[key];
				let equalTo = o => o === objectValue;

				if (blacklist.find(equalTo))
				{
					return false;
				}

				if (whitelist.length > 0)
				{
					return whitelist.every(equalTo)
				}
				else
				{
					return optional.find(equalTo)
				}
			};
		}

		function parseModifiers(values)
		{
			let whitelist = [];
			let optional  = [];
			let blacklist = [];

			function inner(val)
			{
				let p = val.substring(0, 1);

				if (p === OR_MODIFIER)
				{
					optional.push(val.substring(1));
				}
				else if (p === NOT_MODIFIER)
				{
					blacklist.push(val.substring(1));
				}
				else
				{
					whitelist.push(val);
				}
			}

			if (typeof values === "string")
			{
				inner(values);
			}
			else
			{
				values.forEach((val) => {
					inner(val);
				});
			}

			return { whitelist: whitelist, 
					 optional: optional, 
					 blacklist: blacklist };
		}

		function getNumberFilter(key, values)
		{
			function inner(val)
			{
				let s1 = val.substring(0, 1);
				let n1 = Number(val.substring(1));

				let s2 = val.substring(0, 2);
				let n2 = Number(val.substring(2));

				let n3 = Number(val);

				let f = s1 === "!"  ? o => o[key] !== n1 :
						s1 === ">"  ? o => o[key] > n1 :
						s1 === "<"  ? o => o[key] < n1 :
						s2 === "x>" ? o => o[key] >= n2 :
						s2 === "x<" ? o => o[key] <= n2 :
									  o => o[key] === n3;

				return f;
			}

			let filters = [];
			if (typeof values === "string")
			{
				filters.push(inner(values));
			}
			else
			{
				values.forEach((val) => {
					filters.push(inner(val));
				});
			}

			return combineFilters(filters);
		}

		function combineFilters(filters)
		{
			return (obj) => {
				return !filters.find(f => !f(obj));
			}; 
		}

		function sort(arr, sortMethods)
		{
			function recursiveSort(o1, o2, i)
			{
				let val = sortMethods[i](o1, o2);
				let next = i + 1;
				if (val === 0 && next < sortMethods.length)
				{
					return recursiveSort(o1, o2, next);
				}
				else
				{
					return val;
				}
			}

			arr.sort((o1, o2) => recursiveSort(o1, o2, 0));
		}

		function find(arr, item)
		{
			return arr.find(o => o === item);
		}
	}).call(function(){});
}).call(this);
