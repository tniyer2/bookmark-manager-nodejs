
import {
    InvalidArgument, isUdf, isString,
    swap, makeArray, make2DArray
} from "./utility";

const CASE_DIFFERENCE_PENALTY = 0.1;
const FOUND_AT_START_PENALTY = 0.3;
const FOUND_AT_END_PENALTY = 0.3;
const FOUND_IN_MIDDLE_PENALTY = 0.85;

/*
Returns a number between 0 (inclusive) to 100 (inclusive)
measuring the similarity of two strings.
*/
function calcRatio(stringA, stringB) {
    if (!isString(stringA)) {
        throw new InvalidArgument(`Invalid argument 'stringA'.`);
    } else if (!isString(stringB)) {
        throw new InvalidArgument(`Invalid argument 'stringB'.`);
    }

    const stringAIsEmpty = stringA.length === 0;
    const stringBIsEmpty = stringB.length === 0;
    // exclusive or
    if (stringAIsEmpty !== stringBIsEmpty) return 0;

    if (stringA === stringB) return 100;

    const splitTokens = s => s
        .split(/\s/)
        .filter(t => t.length > 0);

    const tokensA = splitTokens(stringA);
    const tokensB = splitTokens(stringB);

    const lowestDistances = makeArray(tokensA.length)
        .map(() => Number.MAX_VALUE);
    const lengths = makeArray(tokensA.length);

    for (let i = 0; i < tokensA.length; ++i) {
        const a = tokensA[i];

        for (let j = 0; j < tokensB.length; ++j) {
            const b = tokensB[j];

            const distance = calcDistance(a, b);

            if (distance < lowestDistances[i]) {
                lowestDistances[i] = distance;
                lengths[i] = Math.max(a.length, b.length);
            }
        }
    }

    const sum = arr => arr
        .reduce((a, b) => a + b, 0);

    const totalLength = sum(lengths);
    const totalDistance = sum(lowestDistances);

    const ratio = (totalLength - totalDistance) / totalLength;
    return ratio * 100;
}

function calcDistance(tokenA, tokenB) {
    const [containsOther, distance] = doesTokenContainOther(tokenA, tokenB);

    if (containsOther) {
        return distance;
    } else {
        return calcLevenshteinDistance(tokenA, tokenB);
    }
}

function doesTokenContainOther(tokenA, tokenB) {
    const aIsShorter = tokenA.length < tokenB.length;
    if (aIsShorter) {
        [tokenA, tokenB] = swap(tokenA, tokenB);
    }

    const index = tokenA.indexOf(tokenB);
    if (index === -1) {
        return [false, null];
    }

    let distance = tokenA.length - tokenB.length;

    const foundAtStart = index === 0;
    const foundAtEnd = index === distance;

    let penalty;
    if (foundAtStart) {
        penalty = FOUND_AT_START_PENALTY;
    } else if (foundAtEnd) {
        penalty = FOUND_AT_END_PENALTY;
    } else {
        penalty = FOUND_IN_MIDDLE_PENALTY;
    }

    distance *= penalty;

    return [true, distance];
}

function calcLevenshteinDistance(tokenA, tokenB) {
    const table = make2DArray(tokenA.length + 1, tokenB.length + 1);

    for (let i = 0; i < tokenA.length + 1; ++i) {
        for (let j = 0; j < tokenB.length + 1; ++j) {
            if (i === 0) {
                table[i][j] = j;
            } else if (j === 0) {
                table[i][j] = i;
            } else {
                const cost = calcCost(
                    tokenA.charAt(i - 1),
                    tokenB.charAt(j - 1)
                );

                table[i][j] = Math.min(
                    table[i - 1][j - 1] + cost,
                    table[i - 1][j] + 1,
                    table[i][j - 1] + 1
                );
            }
        }
    }

    const distance = table[tokenA.length][tokenB.length];
    return distance;
}

function calcCost(charA, charB) {
    if (charA === charB) {
        return 0;
    } else if (charA.toLowerCase() === charB.toLowerCase()) {
        return CASE_DIFFERENCE_PENALTY;
    } else {
        return 1;
    }
}

const SINGLE_VALUE_KEYS = ["title"];
const STRING_KEYS = ["title", "id", "category", "srcUrl", "docUrl"];
const NUMBER_KEYS = ["date", "bytes"];

const NOT_MODIFIER = "!";
const OR_MODIFIER = "*";

const NUMBER_FILTER_BUILDERS = {
    "!": (key, n) => o => o[key] !== n,
    ">": (key, n) => o => o[key] > n,
    "<": (key, n) => o => o[key] < n,
    "x>": (key, n) => o => o[key] >= n,
    "<x": (key, n) => o => o[key] <= n
};
const defaultNumberFilterBuilder = (key, n) => o => o[key] === n;

const SEARCH_TOLERANCE = 70;

function searchContent(allContent, query) {
    const { filter, sorter } = makeFilterAndSorter(allContent, query);

    const results = allContent.filter(filter);

    if (sorter !== null) {
        results.sort(sorter);
    }

    return results;
}

function makeFilterAndSorter(allContent, query) {
    const filters = [];
    const sorters = [];

    filters.push(...makeStringAndNumberFilters(query));

    const title = query.title;
    if (!isUdf(title)) {
        const { filter, sorter } = makeTitleFilterAndSorter(allContent, title);

        filters.push(filter);
        sorters.push(sorter);
    }

    const tags = query.tags;
    if (!isUdf(tags)) {
        const { filter, sorter } = makeTagsFilterAndSorter(allContent, tags);

        filters.push(filter);
        sorters.push(sorter);
    }

    const sortKeys = query.sort;
    if (!isUdf(sortKeys)) {
        sorters.push(...sortKeys.map(key => makeSorter(key)));
    }

    const filter = combineFilters(filters);
    const sorter = combineSorters(sorters);

    return { filter, sorter };
}

function makeStringAndNumberFilters(query) {
    const filters = Object.keys(query)
    .flatMap((key) => {
        if (SINGLE_VALUE_KEYS.includes(key)) return [];

        const queriedValues = query[key];

        if (STRING_KEYS.includes(key)) {
            return [makeStringFilter(key, queriedValues)];
        } else if (NUMBER_KEYS.includes(key)) {
            return queriedValues
                .map(v => makeNumberFilter(key, v));
        }

        return [];
    });

    return filters;
}

function makeStringFilter(key, queriedValues) {
    const [requiredValues, optionalValues, blacklistedValues] = parseQueriedValues(queriedValues);

    const filter = (content) => {
        const value = content[key];

        if (blacklistedValues.includes(value)) {
            return false;
        } else if (requiredValues.length > 0) {
            return requiredValues.every(x => x === value);
        } else {
            return optionalValues.includes(value);
        }
    };

    return filter;
}

function makeNumberFilter(key, queriedValue) {
    const builders = Object.entries(NUMBER_FILTER_BUILDERS);
    const index = builders
        .findIndex(([operator]) => queriedValue.startsWith(operator));

    if (index === -1) {
        return defaultNumberFilterBuilder(key, Number(queriedValue));
    }

    const [operator, makeFilter] = builders[index];

    const num = Number(queriedValue.substring(operator.length));

    return makeFilter(key, num);
}

function makeTitleFilterAndSorter(allContent, queriedTitle) {
    const ratios = new Map();

    for (let i = 0; i < allContent.length; ++i) {
        const content = allContent[i];

        const ratio = calcRatio(queriedTitle, content.title);
        ratios.set(content.id, ratio);
    }

    const filter = o => ratios.get(o.id) > SEARCH_TOLERANCE;

    const sorter = (a, b) => ratios.get(b.id) - ratios.get(a.id);

    return { filter, sorter };
}

function makeTagsFilterAndSorter(allContent, queriedTags) {
    const [requiredTags, optionalTags, blacklistedTags] = parseQueriedValues(queriedTags);

    function scoreTags(content) {
        const tags = content.tags;

        const tagExists = tag => tags.indexOf(tag) !== -1;

        if (blacklistedTags.some(tagExists)
            || !requiredTags.every(tagExists)) {
            return null;
        }

        return optionalTags.map(tagExists).filter(x => x).length;
    }

    const tagScores = new Map();

    for (let i = 0; i < allContent.length; ++i) {
        const content = allContent[i];

        tagScores.set(content.id, scoreTags(content));
    }

    const filter = o => tagScores.get(o.id) !== null;

    const sorter = (a, b) => tagScores.get(b.id) - tagScores.get(a.id);

    return { filter, sorter };
}

function parseQueriedValues(queriedValues) {
    const required = [];
    const optional = [];
    const blacklisted = [];

    function parseTag(value) {
        const modifier = value[0];

        if (modifier === OR_MODIFIER) {
            optional.push(value.substring(1));
        } else if (modifier === NOT_MODIFIER) {
            blacklisted.push(value.substring(1));
        } else {
            required.push(value);
        }
    }

    for (let i = 0; i < queriedValues.length; ++i) {
        parseTag(queriedValues[i]);
    }

    return [required, optional, blacklisted];
}

function makeSorter(key) {
    const descending = key[0] === NOT_MODIFIER;
    if (descending) {
        key = key.substring(1);
    }

    let sorter;
    if (STRING_KEYS.includes(key)) {
        sorter = (a, b) => a[key].localeCompare(b[key]);
    } else if (NUMBER_KEYS.includes(key)) {
        sorter = (a, b) => a[key] - b[key];
    } else {
        throw new SortKeyError(`'${key}' is not a supported sort key.`);
    }

    if (descending) {
        return (a, b) => sorter(b, a);
    } else {
        return sorter;
    }
}

class SortKeyError extends Error {}

function combineFilters(filters) {
    return x => filters.every(f => f(x));
}

/*
Compiles multiple sort functions
so that the sort order is deferred to
the next function if there is a tie.
*/
function combineSorters(sorters) {
    function recursiveSort(a, b, cur) {
        const sort = sorters[cur];
        const sortOrder = sort(a, b);
        const orderIsTied = sortOrder === 0;

        const next = cur + 1;
        const nextSorterExists = next < sorters.length;

        if (orderIsTied && nextSorterExists) {
            return recursiveSort(a, b, next);
        } else {
            return sortOrder;
        }
    }

    if (sorters.length === 0) return null;

    return (a, b) => recursiveSort(a, b, 0);
}

function parseQueryString(query) {
    function split(arr, separator) {
        return arr
            .split(separator)
            .filter(s => s.length > 0);
    }

    const map = Object.create(null);
    if (isUdf(query)) return map;

    const params = split(query, "&");

    for (let i = 0; i < params.length; ++i) {
        const param = params[i];

        const pair = param.split("=");
        if (pair.length !== 2) {
            throw new Error(`'${param}' could not be parsed into a key-value pair.`);
        }
        let [key, values] = pair;

        if (SINGLE_VALUE_KEYS.includes(key)) {
            values = decodeURIComponent(values);
        } else {
            values = split(values, "+")
                .map(s => decodeURIComponent(s));
        }

        map[key] = values;
    }

    return map;
}

export { searchContent, parseQueryString };
