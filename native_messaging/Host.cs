
using System;
using System.IO;

public class Host
{
    public void toApp(Stream outs)
    {
    	Stream stdin = Console.OpenStandardInput();

    	while (true)
    	{
    		readWrite(stdin, outs, false);
    	}
    }

	public void toChrome(Stream ins)
    {
    	Stream stdout = Console.OpenStandardOutput();

    	while (true)
    	{
    		readWrite(ins, stdout, true);
    	}
    }

    public void test()
    {
    	Stream stdin = Console.OpenStandardInput();
    	Stream stdout = Console.OpenStandardOutput();

    	readWrite(stdin, stdout, true);
    }

    private void readWrite(Stream ins, Stream outs, bool writeLen)
    {
    	byte[] lb = new byte[4];
    	ins.Read(lb, 0, 4);
    	int len = BitConverter.ToInt32(lb, 0);

   		byte[] b = new byte[len];
    	ins.Read(b, 0, len);
    	
    	if (writeLen)
    		outs.Write(lb, 0, 4);
    	outs.Write(b, 0, b.Length);

        outs.Flush();
    }
}
