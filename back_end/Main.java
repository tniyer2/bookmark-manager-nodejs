
import java.io.IOException;

import java.net.InetSocketAddress;

import com.tagger.plus.server.ServerStarter;

/*
 * First argument should be domain name to run on.
 * Second argument should be port number to run on.
 *      - if port number is in use it uses the next port.
 */
class Main 
{
    public static final int MAX_PORT = 65535;

	public static void main(String[] args)
	{
        try
        {
            System.out.println();

    		String hostname = args[0];
            int port = Integer.parseInt(args[1]);
            if (port < 0 || port > MAX_PORT)
            {
                System.out.println("Port " + port + " is an invalid port.");
            }

            boolean success = false;
            while(!success && port <= MAX_PORT)
            {
                try
                {
                    InetSocketAddress address = new InetSocketAddress(hostname, port);
                	ServerStarter starter = new ServerStarter(address);
                	starter.getServer().start();
                    success = true;
                }
                catch (IOException e)
                {
                    System.out.println(e);
                    System.out.println("Could not bind with \"" + hostname + ":" + port + "\"");
                    System.out.println();
                    port++;
                }
            }
            if (success)
            {
                System.out.println("Server is running on \"" + hostname + ":" + port + "\"");
            }
            else
            {
                System.out.println("Failed to start Server. Could not bind application to an address.");
            }
            System.out.println();
        }
        catch (RuntimeException e)
        {
            e.printStackTrace();
            throw e;
        }
	}
}