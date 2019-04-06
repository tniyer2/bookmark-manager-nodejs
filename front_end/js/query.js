
(function(){

	let Ratio = (function(){
		const CASE_WEIGHT = 0.1;
		const FOUND_AT_END_WEIGHT = 0.3;
		const FOUND_IN_MIDDLE_WEIGHT = 0.85;

		// @return the ratio that match matches main;
		//		   0(inclusive) to 100(inclusive)
		return function(main, match) {
			// console.log("title: " + main);
			// console.log("query: " + match);

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

			// console.log(sorted);
			// console.log(sortedIndex);

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

		const STRING_KEYS = ["id", "title", "category", "srcUrl", "docUrl"];
		const NUMBER_KEYS = ["date", "bytes"];
		const SEARCH_TOLERANCE = 70;

		this.prototype.query = function(meta, map) {

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
		};
		this.prototype.parse = function(q) {
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
		};
		return new this();

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
			let sortKey;

			if (map.asc)
			{
				sortKey = String(map.asc);
			}
			else if (map.dsc)
			{
				sortKey = String(map.dsc);
			}
			else
			{
				return null;
			}

			if (sortKey === "title" && "title" in map)
			{
				return null;
			}

			sortInfo.reverse = Boolean(map.dsc);

			if (STRING_KEYS.find(element => sortKey === element))
			{
				sortInfo.compare = (first, second) => {
					return first[sortKey].localeCompare(second[sortKey]);
				};
			}
			else if (NUMBER_KEYS.find(element => sortKey === element))
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

		function search(meta, match)
		{
			ratios = {};
			for (let m of meta)
			{
				ratios[m.id] = Ratio(match, m.title);
			}

			meta.sort((first, second) => {
				return ratios[second.id] - ratios[first.id];
			});

			meta = meta.filter((obj) => {
				return ratios[obj.id] > SEARCH_TOLERANCE;
			});

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
	}).call(function(){});
}).call(this);
