
using System;
using System.IO;
using System.Text;

class Logger
{
	public const string fileName = "error_log.txt";

	public static void logError(Exception e)
	{
		log(e.ToString());
	}

	public static void log(string message)
	{
    	byte[] b  = new UnicodeEncoding().GetBytes(message + "\n");
    	logBytes(b);
	}

	public static void logBytes(byte[] b)
	{
		var errStream = new FileStream(fileName, FileMode.Append);

		errStream.Write(b, 0, b.Length);
    	errStream.Flush();
    	errStream.Close();
	}

	public static void clearLog()
	{
		File.Delete(fileName);
	}
}
