var dgram = require('dgram');
var client = dgram.createSocket("udp4");
var serverip = process.argv[2];
var serverPort = 19132;
var ipArray = { };
client.bind(19132);
client.setBroadcast(true);

function packetLog(srcip, srcPort, destip, destPort, type)
{
    //Only log these packets
    filter = Array();
    if (filter.indexOf(type) !== -1 || filter.indexOf("all") !== -1)
    {
        console.log("received: 0x" + type + " from " + srcip + ":" + srcPort + ", sending : 0x" + 
            type + " to " + destip + ":" + destPort);
    }
}

client.on("message", function(msg, rinfo)
{
    packetReceive(msg, rinfo);
});

function packetReceive(msg, rinfo, sendPort)
{
    type = msg.toString('hex').substr(0,2)
    if (rinfo.address !== serverip)
    {
        var portTime = new Date();
        ipArray[rinfo.port] = { 'port': rinfo.port, 'ip': rinfo.address, 
            'time': portTime.getTime(), 'socket': dgram.createSocket("udp4")};
            
        ipArray[rinfo.port].socket.bind(rinfo.port);
        ipArray[rinfo.port].socket.on("message", function(msgg, rinfoo)
        {
            packetReceive(msgg, rinfoo, ipArray[rinfo.port]['port']);
        });
            
    }
    if (rinfo.address !== serverip)
    {
        packetLog(rinfo.address, rinfo.port, serverip, serverPort, type);
        ipArray[rinfo.port].socket.send(msg, 0, msg.length, serverPort, 
            serverip);
    }
    else
    {
        var currentTime = new Date().getTime();
        //Measured in milliseconds
        if ((currentTime - ipArray[sendPort]['time']) > 30000)
        {
            console.log("No packets from " + key + ", removing device");
            ipArray[sendPort].socket.close();
            delete ipArray[sendPort];
        }
        packetLog(rinfo.address, rinfo.port, ipArray[sendPort]['ip'], ipArray[sendPort]['port'], 
            type);
        //console.log("Minecraft port for " + ipArray[sendPort]['ip'] + ": " + 
        //    ipArray[sendPort]['port']);
        client.send(msg, 0, msg.length, ipArray[sendPort]['port'], ipArray[sendPort]['ip']);
    }
}
