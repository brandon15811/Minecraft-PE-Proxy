console.log('Make sure to run npm install after every update to check for new dependencies!');
var dgram = require('dgram');
var dns = require('dns');
var crypto = require('crypto');
var check = require('validator').check;
var mysql = require('mysql');
var EventEmitter = require('events').EventEmitter;
var utils = require('./utils');
var packet = require('./packet').packet;
var nconf = utils.config.nconf;
var IPArray = {};
var portArray = {};
var client = dgram.createSocket('udp4');
var proxy = new EventEmitter();
var proxyStarted = false;
var serverIP;
var serverPort;
var servers;
var mysqlConn;
var closedServers = [];
var serverIPList = [];
var serverIPPortList = [];
var updateList = [];

//Modules to make debugging easier
try
{
    //Appends file and line numbers to console output
    require('console-trace')({
        always: true,
        cwd: __dirname
    });
    //Longer Stacktraces
    require('longjohn');
}
catch(err)
{}

//Set default config values for proxy
nconf.defaults({
    'serverPort': 19132,
    'proxyPort': 19133,
    'interface': {
        'cli': true,
        'web': true
    },
    'dev': false,
    'mysql': {
        'host': '127.0.0.1',
        'user': '',
        'password': '',
        'database': 'proxy'
    },
    'loadbalancer': {
        'tokenSecret': crypto.randomBytes(40).toString('hex'),
        'webIP': '0.0.0.0'
    },
    'logging': {
        'debug': false,
        'info': true,
        'logerror': true,
        'mysql': false

    }
});
proxy.on('dnsLookup', function()
{
    dns.lookup(nconf.get('serverIP'), function(err, address, family)
    {
        if (err !== null)
        {
            if (err.code === 'ENOTFOUND')
            {
                utils.logging.logerror('Domain not found');
                process.exit(1);
            }
            else
            {
                utils.logging.logerror('Unknown error: ' + err.code);
                process.exit(1);
            }
        }
        proxy.emit('setConfig', address);
    });
});

proxy.on('setConfig', function(address)
{
    //Nconf won't save default settings, so we save them here
    //Proxy settings
    ////TODO: Document the case change and add a fallback
    ////FIXME: Re-enable later
    //nconf.set('serverIP', nconf.get('serverIP'));
    //nconf.set('serverPort', nconf.get('serverPort'));
    nconf.set('proxyPort', nconf.getInt('proxyPort'));
    //Interface settings
    ////FIXME: Original webserver removed, replace with new one
    nconf.set('interface:web', nconf.getBoolean('interface:web'));
    nconf.set('interface:cli', nconf.getBoolean('interface:cli'));
    //Developer Mode
    nconf.set('dev', nconf.getBoolean('dev'));
    //Loadbalancer settings (////TODO: Make more dynamic?)
    nconf.set('mysql', nconf.get('mysql'));
    nconf.set('loadbalancer', nconf.get('loadbalancer'));
    //Logging settings
    nconf.set('logging', nconf.get('logging'));
    ////TODO: Re-enable later
    ////serverIP = address;
    serverPort = nconf.get('serverPort');
    setupMySQL();

    nconf.save();

    updateServers(function(err, result)
    {
        if (err)
        {
            utils.logging.logerror('A MySQL error occured while loading servers: ' + err);
            process.exit(1);
        }
        proxyStart();
    });


});

utils.logging.on('logerror', function(msg)
{
    console.error('[ERROR]: ' + msg);
});

proxyConfigCheck();

utils.config.on('serverChange', function(msg)
{
    serverIP = msg.serverIP;
    serverPort = parseInt(msg.serverPort);
    nconf.set('serverIP', serverIP);
    nconf.set('serverPort', serverPort);
    if (msg.proxyPort != nconf.get('proxyPort'))
    {
        client.close();
        nconf.set('proxyPort', parseInt(msg.proxyPort));
        client = dgram.createSocket('udp4');
        proxyStart();
    }
});

function proxyStart()
{
    client.bind(nconf.get('proxyPort'));
    client.on("message", function(msg, rinfo)
    {
        clientIPSetup(msg, rinfo);
    });
    if (nconf.getBoolean("interface:cli") === true)
    {
        var cli = require('./cli').cli;
        cli.start();
    }
    ////FIXME: Old webserver removed, replace with new one
    if (nconf.getBoolean("interface:web") === true)
    {
        ////TODO: change to a plugin
        var web = require('./web').web;
        web.start();
    }
    utils.logging.info("Proxy listening on port: " + nconf.get('proxyPort'));
    var serverList = "";
    for (var key in servers)
    {
        serverList += servers[key]['IP'] + ":" + servers[key]['port'] + ", ";
    }
    utils.logging.info("Forwarding packets to: " + serverList);
    proxyStarted = true;
}

function proxyConfigCheck()
{
    ////TODO: Re-enable later
    /*if (!utils.misc.isNumber(nconf.get('serverPort')))
    {
        utils.logging.logerror('Port specified for --serverPort is not a number')
        process.exit(1);
    }*/
    if (!utils.misc.isNumber(nconf.get('proxyPort')))
    {
        utils.logging.logerror('Port specified for --proxyPort is not a number');
        process.exit(1);
    }
    ////TODO: Re-enable later
    /*
    if (typeof(nconf.get('serverIP')) === 'undefined')
    {
        utils.logging.logerror('No server IP set. Set one with --serverIP <server IP> (only'
        + ' needed on first launch or when changing IPs)');
        process.exit(1);
    }
    try
    {
        //check() throws an error on invalid input
        check(nconf.get('serverIP')).isIP();
        proxy.emit('setConfig', nconf.get('serverIP'));
    }
    catch (err)
    {
        check(nconf.get('serverIP'), "Enter a valid IP or hostname (hostnames like localhost"
        + " are not supported)").isUrl();
        proxy.emit('dnsLookup');
    }*/
    if (nconf.get('mysql:host') === '' ||
        nconf.get('mysql:user') === '' ||
        //nconf.get('mysql:password') === '' ||
        nconf.get('mysql:database') === '')
    {
        utils.logging.logerror('One of the MySQL details are blank in the config');
        process.exit(1);
    }
    proxy.emit('setConfig');
}

function clientIPSetup(msg, rinfo, sendPort)
{
    if (serverIPList.indexOf(rinfo.address) === -1)
    {
        var currentTime = utils.currentTime();
        if (typeof(IPArray[rinfo.address]) === 'undefined')
        {
            mysqlConn.query('SELECT * FROM clients WHERE id = ?', rinfo.address, function(err,
                rows)
            {
                utils.logging.mysql(rows);
                if (rows.length !== 0)
                {
                    IPArray[rinfo.address] = {
                        'destServer': {
                            'IP': rows[0]['destServerIP'],
                            'port': rows[0]['destServerPort']
                        },
                        'time': rows[0]['lastTime']
                    };
                    utils.logging.debug('New client added: ' + rinfo.address);
                    clientPortSetup(msg, rinfo);
                }
                else
                {
                    if (servers.length === 0)
                    {
                        //Ignore new clients from different IPs when there are no open servers
                        return;
                    }
                    IPArray[rinfo.address] = {
                        //Choose random server
                        'destServer': servers[Math.floor(Math.random() * servers.length)],
                        'time': Math.round(utils.currentTime())
                    };
                    var data = {
                        'id': rinfo.address,
                        'destServerIP': IPArray[rinfo.address]['destServer']['IP'],
                        'destServerPort': IPArray[rinfo.address]['destServer']['port'],
                        'lastTime': IPArray[rinfo.address]['time']
                    };
                    mysqlConn.query('INSERT INTO clients SET ?', data, function(err, result)
                    {
                        utils.logging.debug('New client added: ' + rinfo.address);
                        utils.logging.mysql(result);
                        clientPortSetup(msg, rinfo);
                    });
                }
            });
        }
        else
        {
            IPArray[rinfo.address]['time'] = utils.currentTime();
            if (updateList.indexOf(rinfo.address) === -1)
            {
                updateList.push(rinfo.address);
            }
            clientPortSetup(msg, rinfo);
        }
    }
    else
    {
        packetReceive(msg, rinfo, sendPort);
    }
}

function clientPortSetup(msg, rinfo, sendPort)
{
    var currentTime = utils.currentTime();
    if (typeof(portArray[rinfo.port]) === 'undefined')
    {
        mysqlConn.query('SELECT * FROM clients WHERE id = ?', rinfo.port, function(err, rows)
        {
            utils.logging.mysql(rows);
            if (rows.length !== 0)
            {
                portArray[rinfo.port] = {
                    'port': rows[0]['port'],
                    'IP': rows[0]['IP'],
                    'time': rows[0]['lastTime'],
                    'socket': dgram.createSocket("udp4"),
                    'destServer': {
                        'IP': rows[0]['destServerIP'],
                        'port': rows[0]['destServerPort'],
                    }
                };
                portArray[rinfo.port].socket.bind(rinfo.port);
                portArray[rinfo.port].socket.on("message", function(msgg, rinfoo)
                {
                    clientIPSetup(msgg, rinfoo, portArray[rinfo.port]['port']);
                });
                utils.logging.debug('New client added: ' + rinfo.address + ':' + rinfo.port);
                packetReceive(msg, rinfo);
            }
            else
            {
                if (servers.length === 0)
                {
                    //Ignore any new clients from different IPs when there are no open servers
                    return;
                }
                portArray[rinfo.port] = {
                    'port': rinfo.port,
                    'IP': rinfo.address,
                    'time': utils.currentTime(),
                    'socket': dgram.createSocket("udp4"),
                    'destServer': IPArray[rinfo.address]['destServer']
                };
                var data = {
                    'id': rinfo.port,
                    'IP': rinfo.address,
                    'port': rinfo.port,
                    'destServerIP': portArray[rinfo.port]['destServer']['IP'],
                    'destServerPort': portArray[rinfo.port]['destServer']['port'],
                    'lastTime': portArray[rinfo.port]['time']
                };
                portArray[rinfo.port].socket.bind(rinfo.port);
                portArray[rinfo.port].socket.on("message", function(msgg, rinfoo)
                {
                    clientIPSetup(msgg, rinfoo, portArray[rinfo.port]['port']);
                });
                mysqlConn.query('INSERT INTO clients SET ?', data, function(err, result)
                {
                    utils.logging.mysql(result);
                    utils.logging.debug('New client added: ' + rinfo.address + ':' + rinfo.port);
                    packetReceive(msg, rinfo);
                });
            }

        });
    }
    else
    {
        portArray[rinfo.port]['time'] = utils.currentTime();
        if (updateList.indexOf(rinfo.port) === -1)
        {
            updateList.push(rinfo.port);
        }
        packetReceive(msg, rinfo);
    }
}

function packetReceive(msg, rinfo, sendPort)
{
    type = msg.toString('hex').substr(0,2);
    //Send packets to server
    if (serverIPList.indexOf(rinfo.address) === -1)
    {
        packet.emit('receiveRaw', rinfo.address, rinfo.port, portArray[rinfo.port]['destServer']['IP'], portArray[rinfo.port]['destServer']['port'], msg);
        portArray[rinfo.port].socket.send(msg, 0, msg.length, portArray[rinfo.port]['destServer']['port'],
            portArray[rinfo.port]['destServer']['IP']);
    }
    //Without checking the port, the proxy will crash if the server acts like a client
    //Send packets to client
    else// if (rinfo.port == serverPort)
    {
        packet.emit('receiveRaw', rinfo.address, rinfo.port, portArray[sendPort]['IP'],
            portArray[sendPort]['port'], msg);
        client.send(msg, 0, msg.length, portArray[sendPort]['port'], portArray[sendPort]['IP']);
    }
}

//Remove clients that haven't sent any packets in more than 30 seconds
setInterval(function()
{
    if (proxyStarted !== true)
    {
        return;
    }
    var currentTime = utils.currentTime();
    for (var port in portArray)
    {
        if(portArray.hasOwnProperty(port))
        {
            //Remove clients that haven't sent any packets in 30 seconds
            if ((currentTime - portArray[port]['time']) > 30)
            {
                utils.logging.debug("No packets from " + portArray[port]['IP'] + ":" +
                    portArray[port]['port'] + ", removing device");
                portArray[port].socket.close();
                delete portArray[port];
            }
        }
    }

    for (var IP in IPArray)
    {
        if(IPArray.hasOwnProperty(IP))
        {
            //Remove clients that haven't sent any packets in 30 seconds
            if ((currentTime - IPArray[IP]['time']) > 30)
            {
                utils.logging.debug("No packets from " + IPArray[IP]['destServer']['IP'] + ", removing device");
                delete IPArray[IP];
            }
        }
    }
    mysqlConn.query("DELETE FROM clients WHERE ? > lastTime", currentTime - 30, function(err,
        result)
        {
            utils.logging.mysql(result);
        });
}, 15000); //15 seconds

//Update timeouts of clients in mysql every 10 seconds
setInterval(function()
{
    if (proxyStarted !== true)
    {
        return;
    }
    var currentTime = utils.currentTime();
    var oldUpdateList = updateList;
    updateList = [];
    mysqlConn.query('UPDATE clients SET lastTime = ? WHERE id IN(\'' +
    oldUpdateList.join("','") + '\')', currentTime,
    function(err, result)
    {
        utils.logging.mysql(result);
    });
}, 10000); //10 seconds

utils.config.on('changeServerStatus', function(IP, port, status, callback)
{
    if (status === "open")
    {
        status = 1;
    }
    else
    {
        status = 0;
    }
    mysqlConn.query("UPDATE servers SET open = ? WHERE IP = ? AND port = ?", [status, IP, port],
    function(error, result)
    {
        utils.logging.mysql(result);
        if (result['affectedRows'] === 0 || error)
        {
            if (typeof(callback) === 'function')
            {
                callback(error, result);
            }
            return;
        }
        updateServers(function(err, rows)
        {
            callback(err, result, rows);
        });
    });
});

utils.config.on('serverHeartbeat', function(IP, port, currentPlayers, maxPlayers, callback)
{
    mysqlConn.query("SELECT * FROM servers WHERE IP = ? AND port = ?", [IP, port],
    function(error, rows)
    {
        utils.logging.mysql(rows);
        if (rows.length !== 0)
        {
            mysqlConn.query("UPDATE servers SET lastTime = ?, currentPlayers = ?, maxPlayers = ? WHERE IP = ? AND port = ?",
            [utils.currentTime(), currentPlayers, maxPlayers, IP, port],
            function(err, result)
            {
                utils.logging.mysql(result);
                callback(error, result);
            });
        }
        else
        {
            var data = {
                'IP': IP,
                'port': port,
                'name': IP + ":" + port,
                'open': 1,
                'lastTime': utils.currentTime(),
                'currentPlayers': currentPlayers,
                'maxPlayers': maxPlayers
            };
            mysqlConn.query("INSERT INTO servers SET ?", data,
            function(err, result)
            {
                utils.logging.mysql(result);
                callback(err, result);
            });
        }
    });
});

utils.config.on('serverRefresh', function(callback)
{
    updateServers(function(err, result)
    {
        callback(err, result);
    });
});

//Cache server list, update every 15 seconds
setInterval(updateServers, 15000);
function updateServers(callback)
{
    mysqlConn.query('SELECT * FROM servers', function(err, rows)
    {
        utils.logging.mysql(rows);
        servers = [];
        serverIPList = [];
        expiryTime = utils.currentTime() - 30;
        for (var key in rows)
        {
            serverIPList.push(rows[key]['IP']);
            serverIPPortList.push(rows[key]['IP'] + rows[key]['port']);
            if (rows[key]['open'] === 1 && rows[key]['lastTime'] > expiryTime)
            {
                servers.push(rows[key]);
            }
            else
            {
                closedServers.push(rows[key]['IP'] + rows[key]['port']);
            }
        }
        if (typeof(callback) === 'function')
        {
            callback(err, rows);
        }
    });
}

//Delete servers that haven't sent a heartbeat in 24 hours
setInterval(function()
{
    var currentTime = utils.currentTime();
    mysqlConn.query("DELETE FROM servers WHERE ? > lastTime", currentTime - 86400, function(err,
        result)
        {
            utils.logging.mysql(result);
            updateServers();
        });
}, 36000); //1 hour

function setupMySQL()
{
    mysqlConn = mysql.createConnection(nconf.get('mysql'));

    mysqlConn.connect(function(err)
    {
        if(err)
        {
            utils.logging.logerror('error when connecting to db:' + err);
            setTimeout(setupMySQL, 2000);
        }
    });

    mysqlConn.on('error', function(err)
    {
        utils.logging.logerror('db error' + err);
        if(err.code === 'PROTOCOL_CONNECTION_LOST')
        {
            setupMySQL();
        }
        else
        {
            throw err;
        }
    });
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
