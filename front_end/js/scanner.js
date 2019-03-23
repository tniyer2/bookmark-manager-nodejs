
const YOUTUBE_EMBED_URL = "http://www.youtube.com/embed/";
const YOUTUBE_REGEX = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/i;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

	if (msg.to != "scanner.js")
	{
		return;
	}

	if (msg.scan)
	{
		let scanInfo = scanPage();

		console.log("Page was scanned for videos:", scanInfo.list);
		sendResponse(scanInfo);
	}
});

function scanPage()
{
	let youtube = findYoutube();
	if (youtube)
	{
		return {single: youtube};
	}

	let html = document.documentElement.outerHTML;
	let sources = [ findAllOf(html, ".mp4"), 
					findAllOf(html, ".flv"), 
					findAllOf(html, ".mov"),
					findByLinkElm(),
					findByVideoElm() ];

	let final = [];
	for (let arr of sources)
	{
		final = final.concat(arr);
	}

	console.log("scanInfo before removing duplicates:", final);

	final = final.sort((o1, o2) => o1.url.localeCompare(o2.url));
	for (let i = final.length - 1; i > 0; i-=1)
	{
		if (final[i].url === final[i-1].url)
		{
			// Delete the duplicate with a lower priority
			let j = final[i].priority < final[i-1].priority ? i : i-1;
			final.splice(j, 1);
		}
	}

	final = final.sort((o1, o2) => o2.priority - o1.priority);

	return {list: final};
}

function findYoutube()
{
	let href = document.location.href;

	if (href.indexOf("://www.youtube.com") > 0)
	{
		let matches = href.match(YOUTUBE_REGEX);
		let source = YOUTUBE_EMBED_URL + matches[1];
		let h1 = document.querySelector("h1").firstChild.innerText;

		return {url: source, title: h1};
	}
	else
	{
		return null;
	}
}

const VIDEO_PRIORITY = 2;
function findByVideoElm()
{
	let sources = [];

    let a = document.getElementsByTagName("video");
    for (let i = 0; i < a.length; i+=1)
    {
    	let link = a[i];
        let url = null;

	    if (link.src)
	    {
	        url = isValid(link.src);
	    }
	    if (!url && link.hasAttribute("data-thumb"))
	    {
		    url = myTrim(link.getAttribute("data-thumb"));
		    if (url.indexOf("http") == -1)
		    {
		        url = isValid("http:" + url);
		    }
	    }

	    let title = "";
	    if (link.hasAttribute("alt"))
	    {
		    title = myTrim(link.getAttribute("alt"));
	    }
	    else if (link.hasAttribute("title"))
	    {
		    title = myTrim(link.getAttribute("title"));
	    }
		if (!title)
		{
            title = document.title;
		}

		addUrl(url, title);

		let elms = link.querySelectorAll("source");
		for (let i = 0; i < elms.length; i+=1)
		{
			let src = isValid(elms[i].src);
			if (src)
			{ 
				addUrl(src, title);
			}
		}
	}

	function addUrl(url, title)
	{
		if (url)
		{
			sources.push({url: url, title: title, priority: VIDEO_PRIORITY});
		}
	}

	return sources;
}

const LINK_PRIORITY = 1;
function findByLinkElm()
{
	let sources = [];

	let links = document.links;
	for (let i = 0; i < links.length; i+=1)
	{
		let link = links[i];
	    let url = isValid(link.href);

		if (url)
		{
			let title = "";
			if (link.hasAttribute("title"))
			{
				title = myTrim(link.getAttribute("title"));
			}
			if (!title && link.hasAttribute("alt"))
			{
				title = myTrim(link.getAttribute("alt"));
			}
			if (!title)
			{
				title = myTrim(link.innerText);
			}
	        if (!title)
	        {
	            title = document.title;
	        }

			sources.push({url: url, title: title, priority: LINK_PRIORITY});
		}
    }

    return sources;
}

const SEARCH_PRIORITY = 0;
function findAllOf(html, ext)
{
	let sources = [];

	let start = 0;
    while (true)
    {
        let i = html.indexOf(ext, start);
        if (i < 0)
        {
        	break;
        }
        start = i + ext.length;

        let dq = html.indexOf("\"", i);
        let sq = html.indexOf("\'", i);
        let character = null;
        let c_end;
        if (dq > i && sq > i) 
        {
            if (dq > sq)
            {
                character = "\'";
                c_end = sq;
            }
            else
            {
                character = "\"";
                c_end = dq
            }
        }
        else if (dq > i)
        {
            character = "\"";
            c_end = dq;
        }
        else if (sq > i) 
        {
            character = "\'";
            c_end = sq;
        }
        else
        {
            continue;
        }

        let s = html.substr(c_end - 300, 300);
        let c_start = s.lastIndexOf(character);
        if (c_start < 0)
        {
            continue;
        }
        else
        {
        	s = s.substr(c_start + 1);
        }

        s = isValid(s);
        if (s)
        {
        	add(s);
	    }
    }

    function add(s)
    {
    	sources.push({url: s, title: document.title, priority: SEARCH_PRIORITY});
    }

    return sources;
}

function isValid(url)
{
	if (typeof url !== "string")
	{
		return false;
	}
	if (url.indexOf("blob:") === 0)
	{
		return false;
	}
	if (	url.indexOf("http://") === -1 
		&& url.indexOf("https://") === -1)
	{
		return false;
	}
    if (   url.indexOf(".mp4") === -1 
    	&& url.indexOf(".flv") === -1 
    	&& url.indexOf(".mov") === -1)
    {
        return false;
    }

    url = url.replace(/&amp;/g, "&");

	return url;
}

function myTrim(txt)
{
	let trimmed = !txt ? "" : txt.replace(/^[\s_]+|[\s_]+$/gi, '').replace(/(_){2,}/g, "_");
	return trimmed;
}
