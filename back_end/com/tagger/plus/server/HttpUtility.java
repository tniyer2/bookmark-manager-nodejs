
package com.tagger.plus.server;

import java.io.IOException;

import java.net.URI;

import java.util.List;
import java.util.ArrayList;
import java.util.Arrays;

import com.sun.net.httpserver.HttpExchange;

/**
 * Helper functions for dealing with HttpExchanges.
 * @author Tanishq Iyer
 * @version 0.4.1
 */
class HttpUtility
{
    /**
     * Overriden version.
     * close defaults to true.
     */
    public static boolean sendAndCloseResponse(HttpExchange exchange, int rCode, long size)
	{
		return sendAndCloseResponse(exchange, rCode, size, true);
	}

	/**
	 * Convenience method for completing an HttpExchange.
	 * Pre-Condition: Request body has been closed. 
	 * Post-Condition: exchange is complete.
	 * @param exchange the HttpExchange being handled.
	 * @param rCode the response code.
	 * @param size the size of the response body.
	 * @param close if true, closes the response body.
	 * @return true if the response was sent.
	 */
	public static boolean sendAndCloseResponse(HttpExchange exchange, int rCode, long size, boolean close)
	{
		String client = exchange.getRemoteAddress().getHostString();

		try
		{
			exchange.sendResponseHeaders(rCode, size);
			if (close)
			{
				exchange.getResponseBody().close();
			}
		}
		catch (IOException e)
		{
			System.out.println(e);
			System.out.println("Could not send response to " + client + "\n");
			return false;
		}

		return true;
	}

	/**
	 * Utility method to check if a URI is located on this server.
	 * @param uri the URI to check.
	 * @return true if uri's host is this server.
	 */
	public static boolean URIPointsToThis(URI uri)
	{
		String host = uri.getHost();
		if (host == null)
			return false; 
		return host.equals("localhost") || host.equals("127.0.0.1");
	}

	/**
	 * Checks if any of the elments of a List&gt;String&lt; matches a value or matches "*".
	 * @param values a List&gt;String&lt; to search for a match.
	 * @param matchValue the String that an element of values should match.
	 * @return true if matchValue or "*" is found in the List.
	 */
	public static boolean matches(List<String> values, String matchValue)
	{
		String[] arr = values.toArray(new String[0]);
		return Arrays.binarySearch(arr, matchValue) > -1 ||
			   Arrays.binarySearch(arr, "*") > -1;
	}

	/**
	 * Parses Range(s) from a range header.
	 * @param header the header to parse.
	 * @param length the length of the file.
	 * @return a List&gt;Range&lt; parsed from the header 
	 *		   or null if the header couldn't be parsed.
	 */
	public static List<Range> parseRange(String header, long length)
	{
		List<Range> ranges = new ArrayList<Range>(); 

		// length of 'BYTES ' is 6.
        for (String part : header.substring(6).split(",")) 
        {
            long start = sublong(part, 0, part.indexOf("-"));
            long end = sublong(part, part.indexOf("-") + 1, part.length());

            if (start == -1) 
            {
                start = length - end;
                end = length - 1;
            } 
            else if (end == -1 || end > length - 1)
            {
                end = length - 1;
            }

            if (start > end)
            	return null;

            ranges.add(new Range(start, end, length));
        }

        return ranges;
	}

	/**
	 * Parses a long from a String.
	 * @param value the String to parse.
	 * @return the long parsed from value or -1 if value couldn't be parsed or it is null.
	 */
	public static long parseLong(String value)
	{
		if(value == null)
			return -1;

		try
		{
			long parsed = Long.parseLong(value);
			return parsed;
		}
		catch (NumberFormatException e)
		{
			return -1;
		}
	}

	/**
	 * Parses a long from a substring.
	 * @param value the String to get the substring from.
	 * @param start the start of the substring.
	 * @param end the end of the substring.
	 * @return the parsed long or -1 if the substring couldn't be parsed.
	 */
    private static long sublong(String value, int start, int end) 
    {
        String substring = value.substring(start, end);
        return substring.isEmpty() ? -1 : parseLong(substring);
    }
}