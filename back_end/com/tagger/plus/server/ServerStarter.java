
package com.tagger.plus.server;

import java.io.File;
import java.io.IOException;

import java.net.InetSocketAddress;

import java.util.List;

import com.sun.net.httpserver.HttpServer;

import org.json.JSONObject;
import org.json.JSONException;

/**
 * Starts up an HttpServer that serves files and metadata.
 * @author Tanishq Iyer
 * @version 0.4.2
 */
public class ServerStarter
{    
    private static final String RESOURCES_PATH = "resources",
                                META_PATH      = "meta\\meta.json",
                                FILE_CONTEXT   = "/",
                                META_CONTEXT   = "/meta",
                                CHECK_CONTEXT  = "/check";

    private HttpServer server;
 
    /**
     * Constructs a ServerStarter. 
     * Creates a new HttpServer from an InetSocketAddress.
     * Creates a meta context and a check context.
     * Creates a context for each file found in the meta file.
     *      FileHandler or VideoHandler handles this context 
     *      depending on the category property in the metadata. 
     * @param address an InetSocketAddress representing the address you want the server to run on.
     * @throws IOException if failed to create an HttpServer.
     * @throws JSONException if failed to read 'path' or 'category' properties from metadata.
     */
    public ServerStarter (InetSocketAddress address) throws IOException, JSONException
    {
        File resourceDir = new File(RESOURCES_PATH);
        File metaFile    = new File(META_PATH);

        server = HttpServer.create(address, 0);
        DynamicContextCreator dcc = new DynamicContextCreator(resourceDir, server);

        MetaLoader metaLoader = new MetaLoader(metaFile);
        List<JSONObject> metaList = metaLoader.load();

        // Creates a context for each file mentioned in the meta
        for (JSONObject json : metaList)
        {   
            String path     = json.optString("path", null);
            String category = json.getString("category");
            boolean isVideo = category.equals("video");

            if (path != null)
            {
                File file = new File(path);
                String relativeURL = path.replaceAll("\\\\", "/");
                FileHandler handler;

                if (isVideo)
                    handler = new VideoHandler(file);
                else
                    handler = new FileHandler(file);

                server.createContext(FILE_CONTEXT + relativeURL, handler);
            }
        }

        this.server.createContext(META_CONTEXT, new MetaHandler(metaLoader, dcc));
        this.server.createContext(CHECK_CONTEXT, new CheckHandler());

        server.setExecutor(null);
    }

    /**
     * Getter for server.
     * @return server.
     */
    public HttpServer getServer()
    {
        return server;
    }
}
