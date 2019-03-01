
package com.tagger.plus.server;

import java.util.ArrayList;

import org.json.JSONObject;
import org.json.JSONTokener;
import org.json.JSONException;

/**
 * This class is responsible for parsing request bodies into JSON.
 * Request bodies should send JSON with one object per line.
 * @author Tanishq Iyer
 * @version 0.3.0
 */
class RequestParser
{
	/**
	 * Parses request body into an Array of JSONObjects.
	 * Each JSONObject should be separated by a newline.
	 * @param b The request body.
	 * @return an array of JSONObjects parsed from the request body.
	 * @throws JSONException if the request could not be parsed.
	 */
	public JSONObject[] parse(byte[] b) throws JSONException
	{
		String s = new String(b);
		s.trim();

		String[] request;
		request = s.split("\n");

		ArrayList<JSONObject> list = new ArrayList<JSONObject>();

		for(int a = 0; a < request.length; a++)
		{
			request[a].trim();
			if(request[a].isEmpty())
				continue;
			JSONObject obj = new JSONObject( new JSONTokener(request[a]));
			list.add(obj);
		}

		return list.toArray(new JSONObject[0]);
	}
}