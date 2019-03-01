package com.tagger.plus.download;

import java.io.OutputStream;
import java.io.InputStream;
import java.io.IOException;

import java.net.URLConnection;
import java.net.URL;

import java.util.Calendar;

/**
 * Downloads a resource from a URL.
 * @author Tanishq Iyer
 * @version 0.4.0
 */
class URLDownloader extends Downloader
{
	private static final int BUFFER_SIZE = 10000;
	private static final String FAKE_USER_AGENT = "Mozilla/5.0";

	private URL url;
	private OutputStream out;

	/**
	 * Constructs a URLDownloader that downloads from a URL.
	 * @param url URL to download from.
	 * @param out OutputStream to write with.
	 */
	public URLDownloader(URL url, OutputStream out)
	{
		this.url = url;
		this.out = out;
	}

	/**
	 * Downloads file.
	 * @throws IOException if download failed.
	 */
	public void download() throws IOException
	{
		URLConnection connection = url.openConnection();
		connection.addRequestProperty("User-Agent", FAKE_USER_AGENT);
		InputStream in = connection.getInputStream();

		System.out.println("URLDownloader - download(): Downloading . . .");
		
		String progress = "";
		long before = Calendar.getInstance().getTimeInMillis();
		int total = 0;
		int read;

		byte[] b = new byte[BUFFER_SIZE]; 
		while((read = in.read(b, 0, BUFFER_SIZE)) != -1)
		{
			out.write(b, 0, read);

			total += read;
			for(int j = 0; j < progress.length(); j++)
				System.out.print("\b");
			progress = "Downloaded: " + total + " bytes";
			System.out.print(progress);
		}

		long time = (Calendar.getInstance().getTimeInMillis() - before) / (long) 1000;

		in.close();
		out.flush();
		out.close();
		System.out.println();
		System.out.println("Download Completed.");
		System.out.println("Download took " + time + " seconds." + "\n");
	}
}