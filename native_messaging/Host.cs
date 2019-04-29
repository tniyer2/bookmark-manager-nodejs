
using System;
using System.IO;
using System.Net.Sockets;
using System.Linq;
using System.Text;
using System.Threading;

class Host
{
    private const int APP_TIMEOUT = 100;

    private const string 
        STATUS_MESSAGE = "\"status\"",
        CONNECTED_MESSAGE    = "{\"status\": \"connected\", \"tag\": \"status\"}",
        DISCONNECTED_MESSAGE = "{\"status\": \"disconnected\", \"tag\": \"status\"}",
        SENT_MESSAGE = "{\"status\": \"sent\", \"tag\": \"autostatus\"}",
        IMMEDIATE_CONNECTED_MESSAGE = "{\"status\": \"connected\", \"tag\": \"autostatus\"}",
        IMMEDIATE_DISCONNECTED_MESSAGE = "{\"status\": \"disconnected\", \"tag\": \"autostatus\"}";

    private readonly byte[] 
        B_STATUS_MESSAGE,
        B_SENT_MESSAGE,
        B_CONNECTED_MESSAGE,
        B_DISCONNECTED_MESSAGE,
        B_IMMEDIATE_CONNECTED_MESSAGE,
        B_IMMEDIATE_DISCONNECTED_MESSAGE;

    private Stream _appStream;
    private Stream appStream {
        get {
            return _appStream;
        }
        set {
            _appStream = value;
            if (value != null)
            {
                _appStream.ReadTimeout = APP_TIMEOUT;
            }
        }
    }
    private Socket appSocket;

    private Stream stdin, stdout;
    private Connector connector;
    private Object exitLock, appLock;
    private bool endProgram = false;

    public Host()
    {
        var encoding = new UTF8Encoding();
        B_STATUS_MESSAGE = encoding.GetBytes(STATUS_MESSAGE);
        B_SENT_MESSAGE = encoding.GetBytes(SENT_MESSAGE);
        B_CONNECTED_MESSAGE = encoding.GetBytes(CONNECTED_MESSAGE);
        B_DISCONNECTED_MESSAGE = encoding.GetBytes(DISCONNECTED_MESSAGE);
        B_IMMEDIATE_CONNECTED_MESSAGE = encoding.GetBytes(IMMEDIATE_CONNECTED_MESSAGE);
        B_IMMEDIATE_DISCONNECTED_MESSAGE = encoding.GetBytes(IMMEDIATE_DISCONNECTED_MESSAGE);

        stdin  = Console.OpenStandardInput();
        stdout = Console.OpenStandardOutput();
        exitLock = new Object(); 
        appLock  = new Object();
        connector = new Connector();
        connectApp(false);
    }

    public void setAppStream(Socket socket, Stream stream)
    {
        lock (appLock)
        {
            appSocket = socket;
            appStream = stream;
        }
        try {
            write(stdout, B_IMMEDIATE_CONNECTED_MESSAGE);
        } catch (IOException) {/*ignore*/}
    }

    private void connectApp(bool connectOnPortChange)
    {
        var t = new Thread(() => {
            connector.connect((s1, s2) => {
                setAppStream(s1, s2);
            }, connectOnPortChange);
        });

        t.Start();
    }

    private void closeAppConnection()
    {
        if (appStream != null)
        {
            appStream.Close();
            appStream = null;
        }
        appSocket = null;
    }

    public void toApp()
    {
    	while (true)
    	{
            byte[] b;
            try {
                b = read(stdin);
                if (b.Length == 0) {
                    throw new IOException();
                }
            } catch (IOException) {
                lock (appLock) {
                    closeAppConnection();
                }
                lock (exitLock) {   
                    endProgram = true;
                }
                return;
            }

            bool connected;
            bool reconnect = false;
            lock (appLock)
            {
                if (appSocket == null)
                {
                    connected = false;
                }
                else if (!appSocket.Connected)
                {
                    connected = false;
                    closeAppConnection();
                    reconnect = true;
                }
                else
                {
                    connected = true;
                }
            }
            if (reconnect)
            {
                try {
                    write(stdout, B_IMMEDIATE_DISCONNECTED_MESSAGE);
                } catch (IOException) {/*ignore*/}
                connectApp(true);
            }

            // extension is requesting status
            if (Enumerable.SequenceEqual(b, B_STATUS_MESSAGE))
            {
                var message = connected ? B_CONNECTED_MESSAGE : B_DISCONNECTED_MESSAGE;
                try {
                    write(stdout, message);
                } catch (IOException) {/*ignore*/}
            }
            else if (connected)
            {
                try {
                    write(appStream, b);
                } catch (IOException) {
                    continue;
                }
                try {
                    write(stdout, B_SENT_MESSAGE);
                } catch (IOException) {
                    continue;
                }
            }
            else {/*not connected so no action to be taken*/}
    	}
    }

	public void toChrome()
    {
    	while (true)
    	{
            byte[] b;
            lock (exitLock)
            {
                if (endProgram)
                {
                    return;
                }
            }

            lock (appLock)
            {
                if (appStream == null || appSocket == null || !appSocket.Connected)
                {
                    continue;
                }
            }

            try {
                b = read(appStream);
            } catch (IOException) {
                continue;                   
            }
            try {
                write(stdout, b);
            } catch (IOException) {
                continue;
            }
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
    	byte[] lenBuff = new byte[4];
    	ins.Read(lenBuff, 0, 4);
    	int len = BitConverter.ToInt32(lenBuff, 0);

   		byte[] b = new byte[len];
    	ins.Read(b, 0, len);

        return b;
    }

    private void write(Stream outs, byte[] b, bool writeLen = true)
    {
        byte[] lenBuff = BitConverter.GetBytes(b.Length);

        if (writeLen)
        {
            outs.Write(lenBuff, 0, 4);
        }
        outs.Write(b, 0, b.Length);

        outs.Flush();
    }
}
