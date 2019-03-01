
package com.tagger.plus.server;

import java.io.IOException;

import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpExchange;

/**
 * CheckHandler handles HEAD requests sent by the client to check if the server is running on a port.
 * @author Tanishq Iyer
 * @version 0.4.2
 */
class CheckHandler implements HttpHandler
{
	/**
	 * Handles HEAD requests sent by the client to check if the server is running on a port.
	 * @param exchange an HttpExchange to handle.
	 * @throws IOException
	 */
	public void handle(HttpExchange exchange) throws IOException
	{
		String client  = exchange.getRemoteAddress().getHostString();
		String context = exchange.getHttpContext().getPath();
		String method  = exchange.getRequestMethod();

		exchange.getRequestBody().close();

		if (method.equals("HEAD"))
		{
			System.out.println(client + " requested HEAD at " + context + "\n");
			HttpUtility.sendAndCloseResponse(exchange, 200, -1, false);
		}
		else
		{
			System.out.println(client + " sent unsupported request method(" + method
	   						   		  + ") to " + context + "\n");
		}
	}
}