var dgram = require('dgram');
var client = dgram.createSocket("udp4");
var serverip = process.argv[2];
var serverPort = 19132;
var ipArray = { };
client.bind(19132);
client.setBroadcast(true);

client.on("message", function (msg, rinfo) {
    type = msg.toString('hex').substr(0,2)
     if (rinfo.address !== serverip)
     {
        var portTime = new Date();
        ipArray[rinfo.address] = { 'port': rinfo.port, 'ip': rinfo.ip, 'time': portTime.getTime()};
     }
     if (rinfo.address !== serverip)
     {
            if (type !== "c0")
            {
        console.log("received: 0x" + type + " from " +
     rinfo.address + ":" + rinfo.port + ", sending : 0x" + type + " to " + serverip + ":" + serverPort);
            }
        client.send(msg, 0, msg.length, serverPort, serverip);
     }
     else
     {
        //client.send(msg, 0, msg.length, ipArray[rinfo.address], clientip);
        for (key in ipArray)
        {
            if (ipArray.hasOwnProperty(key)) {
                    if (type !== "c0")
                    {
                console.log("received: 0x" + type + " from " +
     rinfo.address + ":" + rinfo.port + ", sending : 0x" + type + " to " + key + ":" + ipArray[key]['port']);
                    }
                client.send(msg, 0, msg.length, ipArray[key]['port'], key);
                //console.log("Minecraft port for " + key + ": " + ipArray[key]['port']);
            } 
        }
     }
 });

