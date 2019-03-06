
using System;
using System.IO;
using System.Net.Sockets;
using System.Threading;
using System.Text;
 
public class Program
{
	private const string PORT_PATH = "port"; 

    public static void Main()
    {
    	try
    	{
	    	var fs = new FileStream(PORT_PATH, FileMode.Open, FileAccess.Read);
	    	byte[] b = new byte[4];
	    	fs.Read(b, 0, 4);
	    	int port = BitConverter.ToInt32(b, 0);
	    	fs.Close();

	    	var client = new TcpClient("localhost", port);
	    	var stream = client.GetStream();

	        var host = new Host();

	        var inThread = new Thread(() => {host.toApp(stream);});
	        inThread.Start();

	        var outThread = new Thread(() => {host.toChrome(stream);});
	        outThread.Start();
	    }
	    catch (Exception e)
	    {
	    	var errStream = new FileStream("error_log.txt", FileMode.OpenOrCreate);

	    	string message = e.ToString();
	    	byte[] b  = new UnicodeEncoding().GetBytes(message);

	    	errStream.Write(b, 0, b.Length);
	    	errStream.Flush();
	    	errStream.Close();
	    }
    }
}
