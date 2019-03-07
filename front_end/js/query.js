
const STRING_KEYS = ["id", "title", "category", "srcUrl", "docUrl"];
const NUMBER_KEYS = ["date", "bytes"];

const SEND_RAW = "all";
const SEARCH_TOLERANCE = 70;

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
