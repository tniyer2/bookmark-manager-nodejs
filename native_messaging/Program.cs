
using System;

class Program
{
    public static void Main()
    {
    	try
    	{
	    	var host = new Host();
            host.start();
	    }
	    catch (Exception e)
	    {
	    	Logger.logError(e);
	    	throw;
	    }
    }
}
