
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
                var watcher = new FileSystemWatcher(@"C:\Projects\tagger-plus\native_messaging");
                watcher.Filter = "port";
                watcher.Changed += onChanged;
                watcher.EnableRaisingEvents = true;
                Logger.log("Connecting after port change");
            }
            else
            {
                connect();
                Logger.log("Connecting without waiting for port change");
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
            var watcher = (FileSystemWatcher) source;

            Logger.log("onChanged called");
            Logger.log("\tName: " + e.Name);
            connect();
            watcher.Changed -= onChanged;
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
}