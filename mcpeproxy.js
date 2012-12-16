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
        console.log("received: 0x" + type + " from " + srcip + ":" + srcPort
            + ", sending : 0x" + type + " to " + destip + ":" + destPort);
    }
}
client.on("message", function (msg, rinfo) {

    type = msg.toString('hex').substr(0,2)
    if (rinfo.address !== serverip)
    {
       var portTime = new Date();
       ipArray[rinfo.address+":"+rinfo.port] = { 'port': rinfo.port, 'ip': rinfo.ip, 'time': portTime.getTime()};
    }
    if (rinfo.address !== serverip)
    {
       packetLog(rinfo.address, rinfo.port, serverip, serverPort, type);
       client.send(msg, 0, msg.length, serverPort, serverip);
    }
    else
    {
       for (key in ipArray)
       {
           if (ipArray.hasOwnProperty(key)) {
               ip = key.split(":");
               packetLog(rinfo.address, rinfo.port, ip[0], ipArray[key]['port'], type);
               //console.log("Minecraft port for " + ip[0] + ": " + ipArray[key]['port']);
               client.send(msg, 0, msg.length, ipArray[key]['port'], ip[0]);
           }
       }
    }
});
