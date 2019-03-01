package com.tagger.plus.download;

import java.net.URI;
import java.net.URL;

import java.io.OutputStream;
import java.io.IOException;
import java.net.MalformedURLException;

/**
 * Downloads from a URI.
 * Does not use any memory to cache download.
 * Directly writes download to hard drive.
 * @author Tanishq Iyer
 * @version 0.4.0
 */
public abstract class Downloader
{
	private static final String DATA_SCHEME = "data"; 

	/**
	 * Creates a Downloader that will download from a URI using an OutputStream.
	 * @param uri Where to download from.
	 * @param out Stream to write the download.
	 * @return the created Downloader object.
	 */
	public static Downloader createDownloader(URI uri, OutputStream out)
	{
		URL url;
		try
		{
			url = uri.toURL();
		}
		catch (MalformedURLException e)
		{
			String scheme = uri.getScheme();

			if(scheme.equals(DATA_SCHEME))
			{
				return new Base64Downloader(uri, out);
			}
			else
			{
				return null;
			}
		}

		return new URLDownloader(url, out);
	}

	/**
	 * Downloads file. 
	 * @throws IOException
	 */
	public abstract void download() throws IOException;
}