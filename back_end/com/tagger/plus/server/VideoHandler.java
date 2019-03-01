
package com.tagger.plus.server;

import java.util.List;
import java.util.ArrayList;

import java.io.File;
import java.io.RandomAccessFile;

import java.io.InputStream;
import java.io.FileInputStream;
import java.io.BufferedInputStream;
import java.io.PrintWriter;

import java.io.OutputStream;

import java.io.IOException;
import java.io.FileNotFoundException;

import javax.crypto.Cipher;

import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.Headers;

/**
 * Handles HTTP requests for a video file.
 * Supports HEAD and GET.
 * @author Tanishq Iyer
 * @version 0.4.2
 */
class VideoHandler extends FileHandler
{
	private static final int BUFFER_SIZE = 10240;
	private static final long EXPIRE_TIME = 604800000L;
	private static final String MULTIPART_BOUNDARY = "MULTIPART_BYTERANGES";

	/**
	 * Constructs a VideoHandler that serves a video.
	 * @param file file to serve.
	 */
	public VideoHandler(File file)
	{
		super(file);
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
        String  client = exchange.getRemoteAddress().getHostString();

		Headers requestHeaders  = exchange.getRequestHeaders();
		Headers responseHeaders = exchange.getResponseHeaders();

		String fileName = file.getName();
        long fileLength = file.length();
        long lastModified = file.lastModified();
        String eTag = fileName + "-" + fileLength + "-" + lastModified;
        long expires = System.currentTimeMillis() + EXPIRE_TIME;

        // Sends 304 Not Modified if etag matches the etag in the header.
        List<String> ifNoneMatch = requestHeaders.get("If-None-Match");
        if (ifNoneMatch != null && HttpUtility.matches(ifNoneMatch, eTag))
        {
        	responseHeaders.set("ETag", eTag);
        	responseHeaders.set("Expires", "" + expires); 
            HttpUtility.sendAndCloseResponse(exchange, 304, -1);
            return;
        }

        // Send 304 Not Modified if the resource hasn't been modified after the time in the header.
        long ifModifiedSince = HttpUtility.parseLong(requestHeaders.getFirst("If-Modified-Since"));
        if (ifNoneMatch == null && ifModifiedSince != -1 && ifModifiedSince + 1000 > lastModified) 
        {
            responseHeaders.set("ETag", eTag);       // Required in 304.
            responseHeaders.set("Expires", "" + expires); // Postpone cache with 1 week.
            HttpUtility.sendAndCloseResponse(exchange, 304, -1);
            return;
        }

        // Send 412 Precondition Failed if etag does not match the etag in the header.
        List<String> ifMatch = requestHeaders.get("If-Match");
        if (ifMatch != null && !HttpUtility.matches(ifMatch, eTag)) 
        {
            HttpUtility.sendAndCloseResponse(exchange, 412, -1);
            return;
        }

        // Sends 412 Precondition Failed if the resource has been modified after the time in the header.
        long ifUnmodifiedSince = HttpUtility.parseLong(requestHeaders.getFirst("If-Unmodified-Since"));
        if (ifUnmodifiedSince != -1 && ifUnmodifiedSince + 1000 <= lastModified) 
        {
            HttpUtility.sendAndCloseResponse(exchange, 412, -1);
            return;
        }

        Range full = new Range(0, fileLength - 1, fileLength);
        List<Range> ranges = new ArrayList<Range>();
        List<String> range = requestHeaders.get("Range");

        if (range != null)
        {
            // Sends 416 Requsted Range not Satisfiable if range is not properly formatted.
            if(!range.get(0).matches("^bytes=\\d*-\\d*(,\\d*-\\d*)*$"))
            {
                responseHeaders.set("Content-Range", "bytes */" + fileLength);
                HttpUtility.sendAndCloseResponse(exchange, 416, -1);
                return;
            }

            // Sends the entire thing if the entity has changed.
            // Value of If-Range could either be an eTag or a date.
            String ifRange = requestHeaders.getFirst("If-Range");
            if (ifRange != null && !ifRange.equals(eTag))
            {
                long ifRangeTime = HttpUtility.parseLong(ifRange);
                if (ifRangeTime != -1)
                {
                    if (ifRangeTime + 1000 < lastModified)
                        ranges.add(full);
                }
                else
                    ranges.add(full);
            }

            if (ranges.isEmpty())
            {
                ranges = HttpUtility.parseRange(range.get(0), fileLength);
            }
        }

        String contentType = "application/octet-stream";
        String disposition = "inline";
        responseHeaders.set("Content-Disposition", disposition + ";filename=\"" + fileName + "\"");
        responseHeaders.set("Accept-Ranges", "bytes");
        responseHeaders.set("ETag", eTag);
        responseHeaders.set("Last-Modified", "" + lastModified);
        responseHeaders.set("Expires", "" + expires);

        RandomAccessFile videoFile;
        try
        {
            videoFile = new RandomAccessFile(file, "r");
        }
        catch (FileNotFoundException e)
        {
            System.out.println(e);
            HttpUtility.sendAndCloseResponse(exchange, 404, -1, sendBody);
            return;
        }
        OutputStream out = null;
        
        try
        {
            if (ranges.isEmpty() || ranges.get(0) == full) 
            {
                responseHeaders.set("Content-Type", contentType);
                responseHeaders.set("Content-Length", "" + full.length);

                if(sendBody)
                {
                    exchange.sendResponseHeaders(200, full.length);

                    out = exchange.getResponseBody();
                    copyRange(videoFile, out, full.start, full.length);
                }
                else
                {
                    HttpUtility.sendAndCloseResponse(exchange, 204, -1, false);
                }
            }
            else if (ranges.size() == 1) 
            {
                Range r = ranges.get(0);
                responseHeaders.set("Content-Type", contentType);
                responseHeaders.set("Content-Range", "bytes " + r.start + "-" + r.end + "/" + r.total);
                responseHeaders.set("Content-Length", "" + r.length);

                if (sendBody)
                {
                    exchange.sendResponseHeaders(206, r.length);

                    out = exchange.getResponseBody();
                    copyRange(videoFile, out, r.start, r.length);
                }
                else
                {
                    HttpUtility.sendAndCloseResponse(exchange, 204, -1, false);
                }
            } 
            else 
            {
                contentType = "multipart/byteranges; boundary=" + MULTIPART_BOUNDARY;
                responseHeaders.set("Content-Type", contentType);
                exchange.sendResponseHeaders(206, 0);
                out = exchange.getResponseBody();

                PrintWriter pout = new PrintWriter(out);

                if (sendBody)
                {
                    // Send multipart range.
                    for (Range r : ranges) 
                    {
                        // Add multipart boundary and header fields for every range.
                        pout.println();
                        pout.println("--" + MULTIPART_BOUNDARY);
                        pout.println("Content-Type: " + contentType);
                        pout.println("Content-Range: bytes " + r.start + "-" + r.end + "/" + r.total);

                        // Copy single part range of multi part range.
                        copyRange(videoFile, out, r.start, r.length);
                    }

                    // End with multipart boundary.
                    pout.println();
                    pout.println("--" + MULTIPART_BOUNDARY + "--");
                }
                else
                {
                    HttpUtility.sendAndCloseResponse(exchange, 204, -1, false);
                }
            }
        }
        catch (IOException e)
        {
            System.out.println(e);
            System.out.println("Could not send " + file.getPath() + " to " + client + "\n");
            return;
        }
        finally
        {
            if(out != null)
            {
                try
                {
                    out.flush();
                    out.close();
                }
                catch(IOException ignore){}
            }
        }
	}

    /**
     * Copies a range of bytes from a file.
     * @param file the file to be read.
     * @param out the stream to write the file with.
     * @param start start of the range.
     * @param length length of the range.
     * @throws IOException
     */
    private static void copyRange(RandomAccessFile file, OutputStream out, long start, long length) throws IOException
    {
        byte[] b = new byte[BUFFER_SIZE];
        int read;

        if (file.length() == length) 
        {
            // Writes full range.
            while ((read = file.read(b)) > 0)
            {
                out.write(b, 0, read);
            }
        } 
        else 
        {
            // Write partial range.
            file.seek(start);

            while ((read = file.read(b)) > 0) 
            {
                if ((length -= read) > 0) 
                {
                    out.write(b, 0, read);
                } 
                else 
                {
                    out.write(b, 0, (int) length + read);
                    break;
                }
            }
        }
    }
}
