
package com.tagger.plus.server;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;

import java.net.URI;

import javax.crypto.Cipher;
import javax.crypto.CipherOutputStream;

import com.sun.net.httpserver.HttpServer;

import com.tagger.plus.download.Downloader;

/**
 * Creates new contexts at runtime as files get uploaded to the server.
 * @author Tanishq Iyer
 * @version 0.4.2
 */
class DynamicContextCreator
{
    private static final int RANDOM_NAME_LENGTH = 35;

	private HttpServer server;
	private File rootDir;

	/**
	 * Constructs a DynamicContextCreator that can create contexts for resources created at runtime.
 	 * @param rootDir the directory where files should be downloaded.
 	 * @param server the server.
 	 * @throws IllegalArgumentException if rootDir is not a valid directory.
 	 */
	public DynamicContextCreator(File rootDir, HttpServer server) throws IllegalArgumentException 
	{
		this.rootDir = rootDir;
		this.server = server;

		if(!rootDir.isDirectory())
		{
			throw new IllegalArgumentException("rootDir must be a valid directory.");
		}
	}

	/**
 	 * Creates a new context for a file.
 	 * @param file file this context is serving.
     * @param isVideo if file is a video.
     * @return the path of the created context.
 	 */
	public String createContext(File file, boolean isVideo)
	{
		String context = file.getPath().replaceAll("\\\\", "/");

        FileHandler handler;
        if(isVideo)
            handler = new VideoHandler(file);
        else
            handler = new FileHandler(file);

		server.createContext("/" + context, handler);

        return context;
	}

	/**
	 * Downloads from a URI and saves in the main directory.
 	 * @param uri the URI to download from.
 	 * @return the File that was downloaded or null if download failed.
 	 */
	public File download(URI uri)
	{
        File file = getNewFile();
        if(file == null)
            return null;

        try (FileOutputStream out = new FileOutputStream(file))
        {
        	Downloader d = Downloader.createDownloader(uri, out);
        	d.download();
        }
        catch (IOException e)
        {
        	System.out.println(e);
        	return null;
        }

        return file;
	}

	/**
	 * Downloads from a URI and saves in the main directory. 
     * Downloaded file is encrypted.
 	 * @param uri the URI to download from.
 	 * @param cipher the cipher to encrypt the download with.
 	 * @return the File that was downloaded or null if download failed.
 	 */
	public File download(URI uri, Cipher cipher)
	{
        File file = getNewFile();
        if(file == null)
            return null;

        try (CipherOutputStream out = new CipherOutputStream(
                                        new FileOutputStream(file), cipher))
        {
        	
        	Downloader d = Downloader.createDownloader(uri, out);
        	d.download();
        }
        catch (IOException e)
        {
        	System.out.println(e);
        	return null;
        }

        return file;
	}

	/**
 	 * Creates a new file with a random name.
 	 * @return the File that was created.
 	 */
    private File getNewFile()
    {
        File newFile = new File(rootDir, RandomString.getString(RANDOM_NAME_LENGTH));

        try
        {
            newFile.createNewFile();
            return newFile;
        }
        catch(IOException e)
        {
            System.out.println(e);
            System.out.println("File could not be created." + "\n");
            return null;
        }
    }

    /**
     * Deletes a file from the main directory.
     * @param file the File to delete.
     * @throws IllegalArgumentException if the file is not found in the root directory. 
     */
    public boolean deleteFile(File file) throws IllegalArgumentException
    {
        File parent = file.getParentFile();
        if (!rootDir.equals(parent))
        {
            String message = "Could not delete file. The file \'" + file.getPath() + 
                             "\' cannot be found in the root directory.";
            throw new IllegalArgumentException(message);
        }

        return file.delete();
    }
}
