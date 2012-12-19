var dgram = require('dgram');
var nconf = require('nconf');
var path = require('path');
var fs = require('fs');
var configPath = path.join(__dirname, 'config.json')
var ipArray = { };

//Read config from command line arguments, environment variables, and the config file
//(each one takes precedence over the next)
if (!fs.existsSync(configPath))
{
    fs.writeFileSync(configPath, '{}');
}
nconf.argv().env().file({ file: configPath });
nconf.defaults({
    'serverPort': '19132',
    'proxyPort': '19132'
});

nconf.set('serverPort', nconf.get('serverPort'));
nconf.set('proxyPort', nconf.get('proxyPort'));

var serverip = nconf.get('serverip');
var serverPort = nconf.get('serverPort');

if (typeof(serverip) === 'undefined')
{
    console.error('No server ip set. Set one with --serverip <ip> (IP will be saved)');
    process.exit();
}

function start()
{
    var client = dgram.createSocket("udp4");
    client.bind(nconf.get('proxyPort'));
    client.on("message", function(msg, rinfo)
    {
        packetReceive(msg, rinfo);
    });

}

function packetLog(srcip, srcPort, destip, destPort, type)
{
    //Only log these packets
    filter = Array();
    if (filter.indexOf(type) !== -1 || filter.indexOf("all") !== -1)
    {
        console.log("received: 0x" + type + " from " + srcip + ":" + srcPort + ", sending : 0x" 
            + type + " to " + destip + ":" + destPort);
    }
}

function packetReceive(msg, rinfo, sendPort)
{
    type = msg.toString('hex').substr(0,2)
    if (rinfo.address !== serverip)
    {
        var portTime = new Date();
        if (typeof(ipArray[rinfo.port]) === 'undefined')
        {
            ipArray[rinfo.port] = { 'port': rinfo.port, 'ip': rinfo.address, 
                'time': portTime.getTime(), 'socket': dgram.createSocket("udp4")};
            ipArray[rinfo.port].socket.bind(rinfo.port);
            ipArray[rinfo.port].socket.on("message", function(msgg, rinfoo)
            {
                packetReceive(msgg, rinfoo, ipArray[rinfo.port]['port']);
            });    
        }
        else
        {
            ipArray[rinfo.port]['time'] == portTime
        }
        
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
            console.log("No packets from " + ipArray[sendPort]['ip'] + ":" + 
                ipArray[sendPort]['port'] + ", removing device");
            ipArray[sendPort].socket.close();
            delete ipArray[sendPort];
        }
        else
        {
            packetLog(rinfo.address, rinfo.port, ipArray[sendPort]['ip'], 
                ipArray[sendPort]['port'], type);
            //console.log("Minecraft port for " + ipArray[sendPort]['ip'] + ": " + 
            //    ipArray[sendPort]['port']);
            client.send(msg, 0, msg.length, ipArray[sendPort]['port'], ipArray[sendPort]['ip']);
        }
    }
}

process.on( 'SIGINT', function() {
    console.log("Shutting down proxy.")
    nconf.save(function (err) {
        fs.readFile(configPath, function (err, data) {
            if (err !== null)
            {
                console.log("Error saving file: " + err);
            }
            process.exit();
        });
    });
});

start();
