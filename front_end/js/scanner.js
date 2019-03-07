
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

	if (msg.to != "scanner.js")
		return;

	if (msg.check)
	{
		sendResponse(true);
		return;
	}

	if (msg.scan)
	{
		let toScan = msg.html.parent ? msg.html.parent : msg.html.element;
		let scanInfo = scanPage(toScan);

		console.log("Page was scanned for videos. scanInfo:", scanInfo);
		sendResponse(scanInfo);
	}
});

function scanPage(html)
{
	let url = document.location.href;
	let scanInfo = { linkUrls: [], externUrls: [], videoUrls: [] };

	for (let j = 0; j < 3; j+=1)
	{
	    for (let i = 0; ;)
	    {
	        let o = FindFirstUrl(html, j == 2 ? ".mov" : j == 1 ? ".flv" : ".mp4", i);
	        if (!o || !o.start)
	            break;
	        i = o.start;
	        scanInfo.linkUrls.push({ 'url': o.mp4, 'title': document.title, 'type': "link" });
	    }
	}

	for (let link of document.links)
	{
	    let u = isSupportedUrl(link.href);
		if (u)
		{
			let title = '';
			if (link.hasAttribute('title'))
				title = myTrim(link.getAttribute('title'));
			if (!title && link.hasAttribute('alt'))
				title = myTrim(link.getAttribute('alt'));
			if (!title)
				title = myTrim(link.innerText);
	        if (!title)
	            title=document.title;

			let cl = "";
			if (link.hasAttribute('class'))
				cl = myTrim(link.getAttribute('class'));
			scanInfo.externUrls.push({'url': u,'title': title,'class': cl,'id': (link.id ? link.id : ""),'value': '','type': 'extern'});
		}
    }

    type="video";
    a = document.getElementsByTagName('video');
    for (let link of a)
    {
        let u = false;
	    if (link.src)
	        u = link.src;
	    if (!u && link.hasAttribute('data-thumb'))
	    {
		    u = myTrim(link.getAttribute('data-thumb'));
		    if (u.indexOf("http") == -1)
		        u = "http:" + u;
	    }

	    u = isSupportedUrl(u);
	    if ( u)
	    {
		    let title = '';
		    if (link.hasAttribute('alt'))
			    title = myTrim(link.getAttribute('alt'));
		    else if (link.hasAttribute('title'))
			    title = myTrim(link.getAttribute('title'));
			if (!title)
	            title=document.title;
		    let cl = "";
		    if (link.hasAttribute('class'))
			    cl = myTrim(link.getAttribute('class'));

		    scanInfo.videoUrls.push({'url': u,'title': title, 'type': type});
	    }
	}

	return scanInfo;
}

function FindFirstUrl(html, ext, start)
{
    for (; ;) {
        var i = html.indexOf(ext, start);
        if (i < 0)
            return false;
        start = i + ext.length;
        var i1 = html.indexOf('\"', i);
        var i2 = html.indexOf('\'', i);
        var c = false;
        if (i1 > i && i2 > i) {

            c = i1 > i2 ? "\'" : "\"";
            if (i1 > i2)
                i1 = i2;
        }
        else if (i1 > i) {
            c = "\"";

        }
        else if (i2 > i) {
            c = "\'";
            i1 = i2;
        }
        else
            continue;

        var s = html.substr(i1 - 300, 300);
        i2 = s.lastIndexOf(c);
        if (i2 < 0)
            continue;
        s = s.substr(i2 + 1);
        if (s.indexOf("http://") == 0 || s.indexOf("https://") == 0)
            return { mp4: s, start: i1 };
        if (s.indexOf("http:\\/\\/") == 0 || s.indexOf("https:\\/\\/") == 0) {

            s = s.replace(/\\\//g, '\/');
            return { mp4: s, start: i1 };
        }
        continue;
    }
}

function isSupportedUrl( url)
{
    if (!url || !url.toLowerCase)
        return false;
	if ((url.toLowerCase().indexOf('javascript:') != -1) || (url.toLowerCase().indexOf('javascript :') != -1) )
	    return false;
	if ((url.toLowerCase().indexOf('mailto:') != -1) || (url.toLowerCase().indexOf('mailto :') != -1) )
	    return false;
	if (url.indexOf("data:image") != -1)
	    return false;
    if ((url.indexOf(".mp4") == -1) && (url.indexOf(".flv") == -1) && (url.indexOf(".mov") == -1))
        return false;

	return url;
}

function myTrim(txt)
{
	let trimmed = !txt ? "" : txt.replace(/^[\s_]+|[\s_]+$/gi, '').replace(/(_){2,}/g, "_");
	return trimmed;
}
