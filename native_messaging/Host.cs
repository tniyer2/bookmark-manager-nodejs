
using System;
using System.IO;
using System.Net.Sockets;
using System.Threading;

class Host
{
    private Stream _appStream;
    public Stream appStream
    {
        get 
        {
            return _appStream;
        }
        set
        {
            _appStream = value;
            if (value != null)
            {
                _appStream.ReadTimeout = NET_TIMEOUT;
            }
        }
    }
    public Socket socket;

    private const int NET_TIMEOUT = 100;

    private Connector connector;
    private Object exitLock, appLock;
    private bool exit = false;

    public Host()
    {
        exitLock  = new Object(); 
        appLock   = new Object();
        connector = new Connector(this, appLock);
        connectApp(false);
    }

    private void connectApp(bool onPortChange)
    {
        var t = new Thread(() => {
                    connector.connect(onPortChange);
                });
        t.Start();
    }

    public void toApp()
    {
        byte[] b = new byte[0];

    	Stream stdin = Console.OpenStandardInput();

    	while (true)
    	{
            b = read(stdin);

            if (b.Length == 0)
            {
                lock (exitLock)
                {   lock (appLock)
                    {
                        if (appStream != null)
                        {
                            appStream.Close();
                        }
                    }
                    exit = true;
                    return;
                }
            }

            lock (appLock)
            {
                if (socket == null || !socket.Connected)
                {
                    continue;
                }
            }

            write(appStream, b);
    	}
    }

	public void toChrome()
    {
        byte[] b = new byte[0];

        Stream stdout = Console.OpenStandardOutput();

    	while (true)
    	{
            lock (exitLock)
            {
                if (exit)
                {
                    return;
                }
            }

            lock (appLock)
            {
                if (socket != null && !socket.Connected)
                {
                    appStream.Close();
                    socket = null;
                    appStream = null;
                    connectApp(true);
                    continue;
                }

                if (socket == null || !socket.Connected)
                {
                    continue;
                }
            }

            try
            {
                b = read(appStream);
            }
            catch (IOException)
            {
                continue;
            }

            write(stdout, b);
    	}
    }

    public void test()
    {
    	Stream stdin  = Console.OpenStandardInput();
    	Stream stdout = Console.OpenStandardOutput();

        byte[] b = read(stdin);
        write(stdout, b);
    }

    private byte[] read(Stream ins)
    {
    	byte[] lb = new byte[4];
    	ins.Read(lb, 0, 4);
    	int len = BitConverter.ToInt32(lb, 0);

   		byte[] b = new byte[len];
    	ins.Read(b, 0, len);

        return b;
    }

    private void write(Stream outs, byte[] b, bool writeLen = true)
    {
        byte[] lb = BitConverter.GetBytes(b.Length);

        if (writeLen)
        {
            outs.Write(lb, 0, 4);
        }
        outs.Write(b, 0, b.Length);

        outs.Flush();
    }
}
