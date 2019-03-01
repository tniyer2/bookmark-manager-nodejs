
package com.tagger.plus.server;

import java.io.File;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.PrintWriter;
import java.io.IOException;

import java.net.URI;
import java.net.URISyntaxException;

import java.util.List;
import java.util.ArrayList;

import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpExchange;

import org.json.JSONObject;
import org.json.JSONException;

import com.tagger.plus.query.Searcher;

/**
 * MetaHandler handles requests regarding the meta file.
 * All metadata is stored as json. One json per content.
 * Supports:
 * 		GET requests to query content from the meta file.
 * 		POST requests to add metadata to the meta file.
 * 		PUT requests to replace metadata in the meta file.
 * 		DELETE requests to delete metadata from the meta file.
 * @author Tanishq Iyer
 * @Version 0.5.0
 */
class MetaHandler implements HttpHandler
{
	private static final int REQUEST_BUFFER_SIZE = 50000;
	private static final int ID_LENGTH = 35;

	private static final String[] PROPERTY_BLACKLIST = 
		new String[]{"id", "path", "bytes"};

	private DynamicContextCreator dcc;
	private MetaLoader metaLoader;

	private List<JSONObject> metaList;

	/**
	 * Constructs a MetaHandler that uses a DynamicContextCreator and 
	 * loads the meta file using a MetaLoader.
	 * @param metaLoader a MetaLoader to load the meta file.
	 * @param dcc a DynamicContextCreator that can download files 
	 *		  	  and setup new contexts for them.
	 */
	public MetaHandler(MetaLoader metaLoader, DynamicContextCreator dcc)
	{
		this.metaLoader = metaLoader;
		this.dcc = dcc;

		metaList = metaLoader.load();
	}

	/**
	 * Handles HttpExchanges.
	 * @param exchange the HttpExchange to handle.
	 * @throws IOException
	 */
	public void handle(HttpExchange exchange) throws IOException
	{
		try
		{
			String method  = exchange.getRequestMethod();
			String context = exchange.getHttpContext().getPath();
			String client  = exchange.getRemoteAddress().getHostString();

			InputStream in = exchange.getRequestBody();
			byte[] b = new byte[REQUEST_BUFFER_SIZE];
			int read,
				off = 0;
			while ((read = in.read(b, off, REQUEST_BUFFER_SIZE)) > 0)
			{
				off += read;
			}
			in.close();

			if(method.equals("GET"))
			{
				System.out.println(client + " requested GET at " + context);
				sendMeta(exchange);
			}
			else if(method.equals("POST"))
			{
				System.out.println(client + " requested POST at " + context);
				addMeta(exchange, b);
			}
			else if (method.equals("PUT"))
			{
				System.out.println(client + " requested PUT at " + context);
				updateMeta(exchange, b);
			}
			else if(method.equals("DELETE"))
			{
				System.out.println(client + " requested DELETE at " + context);
				deleteMeta(exchange, b);
			}
			else
			{
				System.out.println(client + " sent unsupported request method(" + method
	   			   						  + ") to " + context + "\n");
			}
		}
		catch (RuntimeException e)
		{
			e.printStackTrace();
			throw e;
		}
	}

	/**
	 * Sends metadata to the client based on client's query.
	 * @param exchange the HttpExchange being handled.
	 */
	private void sendMeta(HttpExchange exchange)
	{
		String client = exchange.getRemoteAddress().getHostString();

		URI uri = exchange.getRequestURI();	
		String query = uri.getQuery();
		List<JSONObject> result;

		if (query.equals("all"))
		{
			result = metaList;
		}
		else
		{
			int index = Searcher.search(metaList, query);
			if (index == -1)
			{
				HttpUtility.sendAndCloseResponse(exchange, 404, -1);
				return;
			}
			result = new ArrayList<JSONObject>();
			result.add(metaList.get(index));
		}

		try (OutputStream os = exchange.getResponseBody())
		{
			exchange.sendResponseHeaders(200, 0);
			metaLoader.write(os, result);
		}
		catch (IOException e)
		{
			System.out.println(e);
			System.out.println("Could not send metadata to " + client + "\n");
			return;
		}

		System.out.println("metadata sent to " + client + "\n");
	}

	/**
	 * Adds metadata to the meta list and saves changes to the meta file.
	 * Request body must include two JSONObjects, a command json and a content json, in that order.
	 * There should be one json per line.
	 * Downloads the content if the command json specifies it.
	 * 		Starts a new thread for downloading.
	 *		Adds path property to meta when download is complete.
	 * @param exchange the HttpExchange being handled.
	 * @param b the request body.
	 */
	private void addMeta(HttpExchange exchange, byte[] b)
	{
		JSONObject[] arr;
		try
		{
			RequestParser parser = new RequestParser();
			arr = parser.parse(b);
			if(arr.length != 2)
			{
				System.out.println("Request did not contain the right amount of JSONObjects." + "\n");
				HttpUtility.sendAndCloseResponse(exchange, 400, -1);
				return;
			}
		}
		catch (JSONException e)
		{
			System.out.println(e);
			System.out.println("Could not parse request." + "\n");
			HttpUtility.sendAndCloseResponse(exchange, 400, -1);
			return;
		}

		JSONObject command = arr[0];
		JSONObject content = arr[1];

		String property = hasBlacklisted(content);
		if (property != null)
		{
			System.out.println("Bad request. Content contains blacklisted property \'" + property + "\'");
			HttpUtility.sendAndCloseResponse(exchange, 400, -1);
			return;
		}

		String id = RandomString.getString(ID_LENGTH);
		content.put("id", id);

		metaList.add(content);
		System.out.println("Added content to metaList: " + content.getString("title"));

		metaLoader.save(metaList);
		System.out.println("metaList was saved." + "\n");

		HttpUtility.sendAndCloseResponse(exchange, 200, -1);

		Thread downloadThread = new Thread(() -> {
			boolean downloaded = checkForDownload(command, content); 
			if (downloaded)
			{
				metaLoader.save(metaList);
				System.out.println("metaList was saved after a download." + "\n");
			}
		});
		downloadThread.start();
	}

	/**
	 * Updates certain properties of a JSONObject.
	 * Request body must include two JSONObjects, a command json and a content json, in that order.
	 * There should be one json per line.
	 * Request body must include a command json.
	 * @param exchange the HttpExchange being handled.
	 * @param b the request body.
	 */
	private void updateMeta(HttpExchange exchange, byte[] b)
	{
		JSONObject[] arr;
		try
		{
			RequestParser parser = new RequestParser();
			arr = parser.parse(b);
			if(arr.length != 2)
			{
				System.out.println("Request did not contain the right amount of JSONObjects." + "\n");
				HttpUtility.sendAndCloseResponse(exchange, 400, -1);
				return;
			}
		}
		catch (JSONException e)
		{
			System.out.println(e);
			System.out.println("Could not parse request." + "\n");
			HttpUtility.sendAndCloseResponse(exchange, 400, -1);
			return;
		}

		JSONObject command = arr[0];
		JSONObject content = arr[1];

		String id = command.getString("id");
		int index = Searcher.search(metaList, id);
		if (index == -1)
		{
			HttpUtility.sendAndCloseResponse(exchange, 404, -1);
			return;
		}

		JSONObject old = metaList.get(index);
		String property = hasBlacklisted(content);
		if (property != null)
		{
			System.out.println("Bad request. Content contains blacklisted property \'" + property + "\'");
			HttpUtility.sendAndCloseResponse(exchange, 400, -1);
			return;
		}
		else
		{
			for (String s: JSONObject.getNames(content))
			{
				old.put(s, content.get(s));
			}
		}

		System.out.println("Element #" + index + " in metaList was updated: " + content.getString("title"));

		metaLoader.save(metaList);
		System.out.println("metaList was saved." + "\n");

		HttpUtility.sendAndCloseResponse(exchange, 200, -1);
	}

	/**
	 * Checks if command requests this server to download the content.
	 * If it does, downloads the content and adds the file path to the 
	 * 'path' property in content.
	 * @param command a JSONObject with information about the request.
	 * @param content a JSONObject with information about the content.
	 * @return true if client requested a download and the download worked.
	 */
	private boolean checkForDownload(JSONObject command, JSONObject content)
	{
		boolean doDownload = command.getBoolean("download");
		if (!doDownload)
			return false;

		String srcUrl = content.getString("srcUrl");

		URI uri;
		try
		{
			uri = new URI(srcUrl);
		}
		catch (URISyntaxException e)
		{
			System.out.println(e);
			System.out.println("Client sent content where the key \"srcUrl\" is not a valid URI.");
			System.out.println("\"srcUrl\": " + srcUrl + "\n");
			return false;
		}

		if (HttpUtility.URIPointsToThis(uri))
		{	
			System.out.println("Client tried to upload a file from this server." + "\n");
			return false;
		}

		File file = dcc.download(uri);
		if(file == null)
		{
			System.out.println("Could not download file from " + uri.toString());
			return false;
		}

		boolean isVideo = content.getString("category").equals("video");
		String context  = dcc.createContext(file, isVideo);

		content.put("path", context);
		content.put("bytes", file.length());

		return true;
	}

	/**
	 * Removes a JSONObject from the meta list and saves changes to the meta file.
	 * Request body must be a JSONObject.
	 * It should have an 'id' property that holds the id of the JSONObject to delete.
	 * @param exchange the HttpExchange being handled.
	 * @param b the request body.
	 */
	private void deleteMeta(HttpExchange exchange, byte[] b)
	{
		String client = exchange.getRemoteAddress().getHostString();
		JSONObject command;

		try
		{
		    RequestParser parser = new RequestParser();
			JSONObject[] arr = parser.parse(b);
			if(arr.length != 1)
			{
				System.out.println("Request did not contain the right amount of JSONObjects." + "\n");
				HttpUtility.sendAndCloseResponse(exchange, 400, -1);
				return;
			}
			command = arr[0];
		}
		catch (JSONException e)
		{
			System.out.println(e);
			HttpUtility.sendAndCloseResponse(exchange, 400, -1);
			return;
		}

		String id = command.getString("id");
		int index = Searcher.search(metaList, id);
		if (index == -1)
		{
			HttpUtility.sendAndCloseResponse(exchange, 404, -1);
			return;
		}

		JSONObject old = metaList.get(index);
		String path = old.optString("path", null);

		if (path != null)
		{
			File f = new File(path);
			if(!dcc.deleteFile(f))
			{
				System.out.println("File paired with element #" + index + " of metaList could not be deleted.");
			}
		}

		metaList.remove(old);
		System.out.println("Deleted element #" + index + " of metaList.");

		metaLoader.save(metaList);
		System.out.println("metaList was saved." + "\n");

		HttpUtility.sendAndCloseResponse(exchange, 200, -1);
	}

	/**
	 * Returns a string containing the name of the blacklisted property
	 * if it is found within a JSONObject.
	 * @param obj the JSONObject to check for blacklisted properties.
	 * @return the name of the blacklisted property found or null if nothing was found.
	 */
	private String hasBlacklisted(JSONObject obj)
	{
		for (String s: JSONObject.getNames(obj))
		{
			for (String b: PROPERTY_BLACKLIST)
			{
				if (s.equals(b))
					return s;
			}
		}

		return null;
	}
}
