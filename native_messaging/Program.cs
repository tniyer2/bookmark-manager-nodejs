
using System;
using System.Threading;

class Program
{
    public static void Main()
    {
    	try
    	{
    		Logger.clearLog();

	    	var host = new Host();

	        startIOThread(() => {host.toChrome();});
	        startIOThread(() => {host.toApp();});
	    }
	    catch (Exception e)
	    {
	    	Logger.logError(e);
	    	throw;
	    }
    }

   	private static Thread startIOThread(Action action)
    {
    	var ioThread = new Thread(() => {
			try
        	{
        		action();
        	}
        	catch (Exception e)
        	{
        		Logger.logError(e);
        		throw;
        	}
        });

	    ioThread.Start();
	    return ioThread;
    }
}
