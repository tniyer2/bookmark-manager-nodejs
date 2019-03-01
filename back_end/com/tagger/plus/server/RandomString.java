package com.tagger.plus.server;

import java.util.Random;

/**
 * Generates random alphanumeric strings. 
 * @author Tanishq Iyer
 * @version 0.3.0
 */
class RandomString
{
	private static final String set = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

	/**
	 * Creates a random alphanumeric String of a certain length.
	 * @param length length of the alphanumeric String.
	 * @return the random alphanumeric String.
	 */
	public static String getString(int length)
	{
		String randString = "";
		Random random = new Random();

		for(int i = 0; i < length; i++)
		{
			int randInt = random.nextInt(set.length());
			String randChar = set.substring(randInt, randInt+1);
			randString += randChar;
		}

		return randString;
	}
}
