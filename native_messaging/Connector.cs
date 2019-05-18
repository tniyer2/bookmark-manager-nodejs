
using System;
using System.IO;
using System.Net.Sockets;

class Connector
{
	private const string PORT_PATH = "port";

	public Socket connect()
	{
        int port = getPort(PORT_PATH);

        var socket = new Socket( AddressFamily.InterNetwork, 
                                 SocketType.Stream, 
                                 ProtocolType.Tcp );
        try
        {
            socket.Connect("localhost", port);
        }
        catch (SocketException)
        {
            return null;
        }

        return socket;
	}

    private int getPort(string filePath)
    {
        var fs   = new FileStream(filePath, FileMode.Open, FileAccess.Read);
        byte[] b = new byte[4];
        fs.Read(b, 0, 4);
        fs.Close();

        int port = BitConverter.ToInt32(b, 0);
        return port;
    }

    private static bool IsFileReady(string filename)
    {
        try
        {
            using (FileStream inputStream = File.Open(filename, FileMode.Open, FileAccess.Read))
            {
                return inputStream.Length > 0;
            }
        }
        catch (Exception)
        {
            return false;
        }
    }

    private static void WaitForFile(string filename)
    {
        while (!IsFileReady(filename)) { }
    }
}