var dgram = require('dgram');
var path = require('path');
var fs = require('fs');
var utils = require('./utils');
var nconf = utils.config.nconf;
var webserver = require('./webserver');
var ipArray = { };
var client = dgram.createSocket("udp4");;
var configPath = path.join(__dirname, 'config.json');

if (!fs.existsSync(configPath))
{
    fs.writeFileSync(configPath, '{}');
}
//Read config from command line arguments, environment variables, and the config file
//(each one takes precedence over the next)
nconf.argv().env().file({ file: configPath });
nconf.defaults({
    'serverPort': 19132,
    'proxyPort': 19133
});

var serverip = nconf.get('serverip');
var serverPort = nconf.get('serverPort');

nconf.set('serverip', serverip);
nconf.set('serverPort', parseInt(serverPort));
nconf.set('proxyPort', parseInt(nconf.get('proxyPort')));

var interfaceType = "web";

utils.logging.on('info', function(msg)
{
    console.info('[INFO]: ' + msg);
});

utils.logging.on('error', function(msg)
{
    console.error('[ERROR]: ' + msg);
});

utils.logging.on('debug', function(msg)
{
    console.log('[DEBUG]: ' + msg);
});

utils.config.on('serverChange', function(msg)
{
    serverip = msg.serverip;
    serverPort = parseInt(msg.serverPort);
    nconf.set('serverip', serverip);
    nconf.set('serverPort', serverPort);
    if (msg.proxyPort != nconf.get('proxyPort'))
    {
        client.close();
        nconf.set('proxyPort', parseInt(msg.proxyPort))
        client = dgram.createSocket("udp4");
        startProxy();
    }
});


if (typeof(serverip) === 'undefined')
{
    utils.logging.error('No server ip set. Set one with --serverip <server ip> (only needed on'
        + ' first launch or when changing ips)');
    process.exit(1);
}

function startProxy()
{
    client.bind(nconf.get('proxyPort'));
    client.setBroadcast(true);
    client.on("message", function(msg, rinfo)
    {
        packetReceive(msg, rinfo);
    });

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
            ipArray[rinfo.port]['time'] = portTime;
        }
    }
    if (rinfo.address !== serverip)
    {
        utils.decode.packetLog(rinfo.address, rinfo.port, serverip, serverPort, msg);
        ipArray[rinfo.port].socket.send(msg, 0, msg.length, serverPort,
            serverip);
    }
    else
    {
        var currentTime = new Date().getTime();
        //Measured in milliseconds
        if ((currentTime - ipArray[sendPort]['time']) > 30000)
        {
            utils.logging.debug("No packets from " + ipArray[sendPort]['ip'] + ":" +
                ipArray[sendPort]['port'] + ", removing device");
            ipArray[sendPort].socket.close();
            delete ipArray[sendPort];
        }
        else
        {
            utils.decode.packetLog(rinfo.address, rinfo.port, ipArray[sendPort]['ip'],
                ipArray[sendPort]['port'], msg);
            //utils.logging.debug("Minecraft port for " + ipArray[sendPort]['ip'] + ": " +
            //    ipArray[sendPort]['port']);
            client.send(msg, 0, msg.length, ipArray[sendPort]['port'], ipArray[sendPort]['ip']);
        }
    }
}

process.on('SIGINT', function() 
{
    utils.logging.info("Shutting down proxy.");
    nconf.save(function (err) 
    {
        fs.readFile(configPath, function (err, data) {
            if (err !== null)
            {
                utils.logging.error("Error saving file: " + err);
            }
            process.exit();
        });
    });
});

startProxy();
