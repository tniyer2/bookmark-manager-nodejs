
package com.tagger.plus.server;

import java.io.File;

import java.io.InputStream;
import java.io.FileInputStream;
import java.io.BufferedInputStream;

import java.io.OutputStream;

import java.io.IOException;
import java.io.FileNotFoundException;

import javax.crypto.Cipher;

import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpExchange;

/**
 * Handles HTTP requests for a file.
 * Supports HEAD and GET.
 * @author Tanishq Iyer
 * @version 0.4.2
 */
class FileHandler implements HttpHandler
{
	private static final int BUFFER_SIZE = 10000;

	protected File file;
	protected Cipher cipher;

	/**
	 * Constructs a FileHandler that serves a file.
	 * @param file file to serve.
	 */
	public FileHandler(File file)
	{
		this.file = file;
	}

	/**
	 * Handles HttpExchanges.
	 * @param exchange an HttpExchange to handle.
	 * @throws IOException
	 */
	public void handle(HttpExchange exchange) throws IOException
	{
		try
		{
			String method  = exchange.getRequestMethod();
			String context = exchange.getHttpContext().getPath();
			String client  = exchange.getRemoteAddress().getHostString();

			exchange.getRequestBody().close();		
			
			Runnable r = () -> {
				if (method.equals("GET"))
				{
					System.out.println(client + " requested GET to " + context + "\n");
					serveRequest(exchange, true);
				}
				else if (method.equals("HEAD"))
				{
					System.out.println(client + " requested HEAD to " + context + "\n");
					serveRequest(exchange, false);
				}
				else
				{
					System.out.println(client + " sent unsupported request method(" + method
	   			   		  					  + ") at " + context + "\n");
				}
			};

			Thread t = new Thread(r);
			t.start();
		}
		catch (RuntimeException e)
		{
			e.printStackTrace();
			throw e;
		}
	}

	/**
	 * Serves both GET and HEAD requests.
	 * Pre-Condition: The request body is closed.
	 * Post-Condition: The exchange is complete.
	 * @param exchange the HttpExchange being handled.
	 * @param sendBody if false, does not send the response body.
	 */
	protected void serveRequest(HttpExchange exchange, boolean sendBody)
	{
		String client = exchange.getRemoteAddress().getHostString();

		try
		{
			exchange.sendResponseHeaders(200, file.length());
		}
		catch(IOException e)
		{
			System.out.println(e);
			return;
		}
		OutputStream out = exchange.getResponseBody();

		if (sendBody)
		{
			try (BufferedInputStream in = new BufferedInputStream(
					  					  new FileInputStream(file)))
			{
				sendFile(in, out);
			}		
			catch(FileNotFoundException e)
			{
				System.out.println(e);
				System.out.println(file.getPath() + " cannot be found.");
				System.out.println("File might have been renamed or removed." + "\n");
				return;
			}
			catch(IOException e)
			{
				System.out.println(e);
				System.out.println("Could not send " + file.getPath() + " to " + client + "\n");
				return;
			}
		}
		else
		{
			HttpUtility.sendAndCloseResponse(exchange, 204, -1);
			return;
		}
	}

	/**
	 * Reads from an InputStream and writes it using an OutputStream.
	 * Post-Condition: in and out are closed.
	 * @param in the stream to read with.
	 * @param out the stream to write with.
	 * @throws IOException
	 */
	private void sendFile(InputStream in, OutputStream out) throws IOException
	{
		int i;
		byte[] b = new byte[BUFFER_SIZE]; 
		while((i = in.read(b, 0, BUFFER_SIZE)) != -1)
		{
			out.write(b, 0, i);
		}

		in.close();
		out.flush();
		out.close();
	}
}