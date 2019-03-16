
using System;
using System.IO;
using System.Net.Sockets;

class Connector
{
	private const string PORT_PATH = "port";

    private Host host;
    private Object appLock;

    public Connector(Host host, Object appLock)
    {
        this.host = host;
        this.appLock = appLock;
    }

	public void connect(bool onPortChange)
	{
        try
        {
            if (onPortChange)
            {
                string runningDir = Directory.GetCurrentDirectory();
                // Logger.log("runningDir: " + runningDir);
                var watcher = new FileSystemWatcher(runningDir);
                watcher.Filter = "port";
                watcher.Changed += onChanged;
                watcher.EnableRaisingEvents = true;
                // Logger.log("Connecting after port change");
            }
            else
            {
                connect();
                // Logger.log("Connecting without waiting for port change");
            }
        }
        catch (Exception e)
        {
            Logger.logError(e);
            throw;
        }
	}

    private void connect()
    {
        int port = getPort(PORT_PATH);

        var socket = new Socket( AddressFamily.InterNetwork, 
                                 SocketType.Stream, 
                                 ProtocolType.Tcp );
        socket.Connect("localhost", port);
        var stream = new NetworkStream(socket, true); 

        lock (appLock)
        {
            host.socket = socket;
            host.appStream = stream;
        }
    }

    private void onChanged(object source, FileSystemEventArgs e)
    {
        try
        {
            // Logger.log("onChanged called");
            // Logger.log("\tName: " + e.Name);
            var watcher = (FileSystemWatcher) source;
            watcher.Changed -= onChanged;

            WaitForFile(PORT_PATH);
            connect();
        }
        catch (Exception ex)
        {
            Logger.logError(ex);
            throw;
        }
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