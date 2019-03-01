
const CASE_WEIGHT = 0.1;
const FOUND_AT_END_WEIGHT = 0.3;
const FOUND_IN_MIDDLE_WEIGHT = 0.85;

/*
let s1 = "spacebar red apple black coke";
let s2 = "red spacebar coke black apple";
*/
/*
let s1 = "apples";
let s2 = "apple";
let percentage = ratio(s1, s2);

console.log("First String: " + s1);
console.log("Second String: " + s2);
console.log("Similarity: " + percentage + "%");
*/

function ratio(x, y)
{
	console.log("title: " + x);
	console.log("query: " + y);

	/*
	// outer loop should be smaller string
	if (x.length > y.length)
	{
		let temp = x;
		x = y;
		y = temp;
	}*/

	let split = s => s.split(/\s/).filter(i => i);
	let xterms = split(x);
	let yterms = split(y);

	let sorted = [];
	let sortedIndex = [];
	for (let i in xterms)
	{
		sorted[i] = [];
		sortedIndex[i] = [];
		for (let j in yterms)
		{
			let distance = isInside(xterms[i], yterms[j]);
			if (!distance)
			{
				distance = calcDistance(xterms[i], yterms[j]);
			}

			let insertedAt = binaryInsert(sorted[i], distance);
			sortedIndex[i].splice(insertedAt, 0, Number(j));
		}
	}

	console.log(sorted);
	console.log(sortedIndex);

	let totalCharacters = 0;
	let totalDistance = 0;

	for (let i in sorted)
	{
		totalDistance += sorted[i][0];
		totalCharacters += yterms[sortedIndex[i][0]].length;
	}

	let percentage = (totalCharacters - totalDistance) / totalCharacters * 100;
	console.log("ratio: " + Math.round(percentage) + "%");
	return percentage;
}

function isInside (x, y)
{
	if (x.length === y.length)
		return false;
	// y should be the smaller string
	if (y.length > x.length)
	{
		let temp = x;
		x = y;
		y = temp;
	}

	let i = x.indexOf(y);
	if (i === -1)
	{
		return false;
	}
	else if (i === 0 || i + y.length === x.length)
	{
		return (x.length - y.length) * FOUND_AT_END_WEIGHT;
	}
	else
	{
		return (x.length - y.length) * FOUND_IN_MIDDLE_WEIGHT;
	}
}

function calcDistance(x, y)
{
    let table = [];
 
    for (let i = 0; i <= x.length + 1; i++) 
	{
		table[i] = [];
        for (let j = 0; j <= y.length + 1; j++) 
        {
            if (i === 0)
                table[i][j] = j;
            else if (j === 0) 
                table[i][j] = i;
            else
            {
                table[i][j] = min(table[i - 1][j - 1] 
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

function min(a, b, c)
{
	return Math.min(Math.min(a, b), c);
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
