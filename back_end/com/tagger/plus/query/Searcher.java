
package com.tagger.plus.query;

import java.util.List;

import org.json.JSONObject;
import org.json.JSONException;

/**
 * Searches elements of a List of JSONObjects based on a query. 
 * @author Tanishq Iyer
 * @version 0.5.0
 */
 public class Searcher
 {
 	/**
 	 * Searches for an element with the specified id.
 	 * @param jsonlist the List to search through.
 	 * @param id value of the "id" key of the JSONObject you are searching for.
 	 * @return index of the element with the id or -1 if nothing was found.
 	 * @throws JSONException if an element did not have an "id" property.
 	 */
 	public static int search(List<JSONObject> jsonlist, String id) throws JSONException
 	{
 		for (int i = 0; i < jsonlist.size(); i++)
 		{
 			if (jsonlist.get(i).getString("id").equals(id))
 			{
 				return i;
 			}
 		}

 		return -1;
 	}
 }
