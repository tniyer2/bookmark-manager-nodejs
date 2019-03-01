
package com.tagger.plus.server;

import java.io.File;

import java.io.FileInputStream;
import java.io.InputStreamReader;
import java.io.BufferedReader;

import java.io.OutputStream;
import java.io.FileOutputStream;
import java.io.PrintWriter;

import java.io.IOException;

import java.util.List;
import java.util.ArrayList;

import org.json.JSONObject;
import org.json.JSONTokener;
import org.json.JSONException;

/**
 * This class is responsible for I/O operations on a meta file.
 * The meta file should be a json file with one json object per line.
 * @author Tanishq Iyer
 * @version 0.4.2
 */
class MetaLoader
{
	private File metaFile;

	/**
	 * Constructs a MetaLoader that does I/O operations on a json file. 
	 * @param file the meta file you want this object to handle.
	 *		  	   It should be formatted so that there is only one json 
	 *		  	   object per line.
	 */
	public MetaLoader(File file)
	{
		metaFile = file;
	}

	/**
	 * Parses JSONObject(s) from the json in the meta file.
	 * @return a List&gt;JSONObject&lt; with JSONObject(s) parsed from the meta file.
	 */
	public List<JSONObject> load()
	{
		List<JSONObject> list = new ArrayList<JSONObject>();

		try (	BufferedReader in = new BufferedReader( // Adds efficiency by buffering
				 	 					new InputStreamReader( // Adds efficiency for reading characters
				 	 						new FileInputStream(metaFile)))) // Original InputStream
		{
			String line;
			int count = 1;
			while(( line = in.readLine()) != null)
			{
				JSONObject obj;
				try
				{
					obj = new JSONObject(new JSONTokener(line));
				}
				catch (JSONException e)
				{
					System.out.println(e);
					System.out.println("Could not parse line " + count + " of meta file.");
					System.out.println("path of the meta file: " + metaFile.getPath() + "\n");
					return null;
				}

				list.add(obj);
				count++;
			}
		}
		catch (IOException e)
		{
			System.out.println(e);
			System.out.println("path of the meta file: " + metaFile.getPath() + "\n");
			return null;
		}

		return list;
	}

	/**
 	 * Serializes JSONObject(s) to the meta file. Saves over the file with serialized json.
 	 * @param list the List&gt;JSONObject&lt; you want to serialize.
	 * @return true if the list was saved.
	 */
	public boolean save(List<JSONObject> list)
	{
		try (OutputStream out = new FileOutputStream(metaFile))
		{
			write(out, list);
		}
		catch (IOException e)
		{
			System.out.println(e);
			System.out.println("Could not save meta file." + "\n");
			System.out.println("Filename: " + metaFile.getPath());
			return false;
		}
		return true;
	}

	/**
	 * Serializes a List&gt;JSONObject&lt; and writes it using an PrintWriter.
	 * Post-Condition: os is closed.
	 * @param os the OutputStream you want to use to write the metadata.
	 * @param list A list of JSONObjects you want to serialize.
	 */
	public void write(OutputStream os, List<JSONObject> list) throws IOException
	{
		try (PrintWriter pw = new PrintWriter(os))
		{
			for(JSONObject obj : list)
			{
				pw.println(obj.toString());
			}
		}
	}

	public void write(OutputStream os, JSONObject obj) throws IOException
	{
		try (PrintWriter pw = new PrintWriter(os))
		{
			pw.println(obj.toString());
		}
	}
}