	
module.exports.parseFileName = function (pathname, split) {

	const full    = /\w+(?:\.\w{3,4})+(?!.+\w+(?:\.\w{3,4})+)/;
	let matches = pathname.match(full);
	
	if (matches && matches.length > 0)
	{
		let match = matches[0];

		if (split)
		{
			let p = match.indexOf(".");
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
}
