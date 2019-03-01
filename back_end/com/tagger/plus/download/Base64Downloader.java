package com.tagger.plus.download;

import java.net.URI;

import java.io.OutputStream;
import java.io.InputStream;
import java.io.IOException;

import java.util.Base64;
import java.util.Base64.Decoder;

/**
 * Downloads a resource from a URI following the data scheme with a base64 extension.
 * @author Tanishq Iyer
 * @version 0.4.0
 */
class Base64Downloader extends Downloader
{
	private URI uri;
	private OutputStream out;

	/**
	 * Constructs a Base64Downloader that downloads from a data scheme URI encoded in base64.
	 * @param uri the URI to read from.
	 * @param out the OutputStream to write with.
	 */
	public Base64Downloader(URI uri, OutputStream out)
	{
		this.uri = uri;
		this.out = out;
	}

	/**
	 * Downloads file.
	 * @throws IOException if download failed.
	 */
	public void download() throws IOException
	{
		Base64.Decoder decoder = Base64.getDecoder();

		String ssp = uri.getSchemeSpecificPart();
		String data = ssp.substring(ssp.indexOf(",") + 1);

		byte[] b = decoder.decode(data);
		out.write(b);
		out.flush();
		out.close();
	}
}