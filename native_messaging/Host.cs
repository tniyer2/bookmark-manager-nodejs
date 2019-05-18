
using System;
using System.IO;
using System.Net.Sockets;
using System.Text;

class Host
{
    private const int APP_TIMEOUT = 100;

    private const string DISCONNECTED_MESSAGE = "{\"tag\": \"disconnected\"}";
    private readonly byte[] B_DISCONNECTED_MESSAGE;

    private Stream stdin, stdout;

    public Host()
    {
        var encoding = new UTF8Encoding();
        B_DISCONNECTED_MESSAGE = encoding.GetBytes(DISCONNECTED_MESSAGE);

        stdin  = Console.OpenStandardInput();
        stdout = Console.OpenStandardOutput();
    }

    public void start()
    {
        byte[] b;

        b = read(stdin);
        if (b.Length != 0)
        {
            Socket appSocket = (new Connector()).connect();
            if (appSocket == null)
            {
                write(stdout, B_DISCONNECTED_MESSAGE);
            }
            else
            {
                Stream appStream = new NetworkStream(appSocket, true);
                appStream.ReadTimeout = APP_TIMEOUT;
                write(appStream, b);

                b = read(appStream);
                write(stdout, b);
                appSocket.Close();
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
