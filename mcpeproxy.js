var dgram = require('dgram');
var path = require('path');
var fs = require('fs');
var utils = require('./utils');
var nconf = utils.config.nconf;
var ipArray = { };
var client = dgram.createSocket("udp4");
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
    'proxyPort': 19133,
    'interface': {
        'cli': true,
        'webserver': true
    },
    'dev': false
});

var serverip = nconf.get('serverip');
var serverPort = nconf.get('serverPort');

//Proxy settings
nconf.set('serverip', serverip);
nconf.set('serverPort', parseInt(serverPort));
nconf.set('proxyPort', parseInt(nconf.get('proxyPort')));
//Interface settings
nconf.set('interface:webserver', utils.misc.toBoolean(nconf.get('interface:webserver')));
nconf.set('interface:cli', utils.misc.toBoolean(nconf.get('interface:cli')));
//Developer Mode
nconf.set('dev', utils.misc.toBoolean(nconf.get('dev')));

nconf.save();

if (nconf.getBoolean('dev'))
{
    var packet = require('./packet').packet;
}
else
{
    var packet = {};
    packet.log = function(){};
}
utils.logging.on('logerror', function(msg)
{
    console.error('[ERROR]: ' + msg);
});

proxyConfigCheck();

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

function startProxy()
{
    client.bind(nconf.get('proxyPort'));
    client.setBroadcast(true);
    client.on("message", function(msg, rinfo)
    {
        packetReceive(msg, rinfo);
    });
    if (nconf.get("interface:cli") == true)
    {
        var cli = require('./cli').cli;
        cli.start();
    }
    if (nconf.get("interface:webserver") == true)
    {
        var webserver = require('./webserver').webserver;
        webserver.start();
    }
    utils.logging.info("Proxy listening on port: " + nconf.get('proxyPort'))
    utils.logging.info("Forwarding packets to: " + nconf.get('serverip') + ":" +
        nconf.get('serverPort'));
}

function proxyConfigCheck()
{
    if (typeof(serverip) === 'undefined')
    {
        utils.logging.logerror('No server ip set. Set one with --serverip <server ip> (only'
        + ' needed on first launch or when changing ips)');
        process.exit(1);
    }
    if (!utils.misc.isNumber(nconf.get('serverPort')))
    {
        utils.logging.logerror('Port specified for --serverPort is not a number')
        process.exit(1);
    }
    if (!utils.misc.isNumber(nconf.get('proxyPort')))
    {
        utils.logging.logerror('Port specified for --proxyPort is not a number')
        process.exit(1);
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
            ipArray[rinfo.port]['time'] = portTime.getTime();
        }
    }
    if (rinfo.address !== serverip)
    {
        packet.log(rinfo.address, rinfo.port, serverip, serverPort, msg);
        ipArray[rinfo.port].socket.send(msg, 0, msg.length, serverPort,
            serverip);
    }
    //Without checking the port, the proxy will crash if the server acts like a client
    else if (rinfo.port == serverPort)
    {
        var currentTime = new Date().getTime();
        //Measured in milliseconds
        //FIXME: Use setInterval to check for timed out devices
        if ((currentTime - ipArray[sendPort]['time']) > 30000)
        {
            utils.logging.debug("No packets from " + ipArray[sendPort]['ip'] + ":" +
                ipArray[sendPort]['port'] + ", removing device");
            ipArray[sendPort].socket.close();
            delete ipArray[sendPort];
        }
        else
        {
            packet.log(rinfo.address, rinfo.port, ipArray[sendPort]['ip'],
                ipArray[sendPort]['port'], msg);
            client.send(msg, 0, msg.length, ipArray[sendPort]['port'], ipArray[sendPort]['ip']);
        }
    }
}

process.on('SIGINT', function()
{
    console.info("Shutting down proxy.");
    nconf.save(function (err)
    {
        if (err)
        {
            utils.logging.logerror("Error saving config: " + err);
        }
        process.exit();
    });
});

startProxy();
