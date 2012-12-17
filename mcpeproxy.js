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
    filter = Array("all");
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

function packetReceive(msg, rinfo)
{
    type = msg.toString('hex').substr(0,2)
    if (rinfo.address !== serverip)
    {
       var portTime = new Date();
       ipArray[rinfo.address + ":" + rinfo.port] = { 'port': rinfo.port, 'ip': rinfo.address, 
           'time': portTime.getTime(), 'socket': dgram.createSocket("udp4")};
       ipArray[rinfo.address + ":" + rinfo.port].socket.bind(rinfo.port);
       ipArray[rinfo.address + ":" + rinfo.port].socket.on("message", function(msgg, rinfoo)
       {
           packetReceive(msgg, rinfoo);
       });
           
    }
    if (rinfo.address !== serverip)
    {
       packetLog(rinfo.address, rinfo.port, serverip, serverPort, type);
       ipArray[rinfo.address + ":" + rinfo.port].socket.send(msg, 0, msg.length, serverPort, 
           serverip);
    }
    else
    {
       for (key in ipArray)
       {
           if (ipArray.hasOwnProperty(key)) {
               var currentTime = new Date().getTime();
               //Measured in milliseconds
               if ((currentTime - ipArray[key]['time']) > 30000)
               {
                    console.log("No packets from " + key + ", removing device");
                    ipArray[key].socket.close();
                    delete ipArray[key];
                    continue;
               }
               packetLog(rinfo.address, rinfo.port, ipArray[key]['ip'], ipArray[key]['port'], 
                   type);
               //console.log("Minecraft port for " + ipArray[key]['ip'] + ": " + 
               //    ipArray[key]['port']);
               client.send(msg, 0, msg.length, ipArray[key]['port'], ipArray[key]['ip']);
           }
       }
    }
}
