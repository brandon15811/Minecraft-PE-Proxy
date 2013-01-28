var app = require('http').createServer(handler);
var io = require('socket.io')
var querystring = require('querystring');
var ejs = require('ejs');
var fs = require('fs');
var path = require('path');
var node_static = require('node-static');
var utils = require('./utils');
var packet = require('./packet').packet;
var nconf = utils.config.nconf;
var webserver = this;
var client = {};

webserver.start = function()
{
    app.listen(8001);
    socketServer = io.listen(app);
    socketServer.set('log level', 2)
    socketServer.sockets.on('connection', function(socket)
    {
        socketRoute(socket)
    });
}

function handler (req, res)
{
    if (req.url.substr(0, 7) === '/static')
    {
        req.url = req.url.substr(8);
        var file = new node_static.Server(path.join(__dirname, '/static/'));
        file.serve(req, res, function(err, result)
        {
            res.writeHead(404);
            return res.end('File not found');
        });
    }
    else
    {
        var route = Array('/config', '/');
        if (nconf.getBoolean('dev'))
        {
            route.push('/packets');
        }
        if (route.indexOf(req.url) !== -1)
        {
            if (req.url === '/')
            {
                req.url = '/config';
            }
            fs.readFile(path.join(__dirname, 'layouts/', req.url + '.ejs'),
            function (err, data)
            {
                if (err)
                {
                    res.writeHead(500);
                    return res.end('Error loading file');
                }

                res.writeHead(200);
                res.end(ejs.render(data.toString('ascii'),
                {
                        filename: path.join(__dirname, 'layouts/', req.url + '.ejs'),
                        locals:
                        {
                            nconf: nconf
                        }
                }));
            });
        }
        else {
            res.writeHead(404);
            return res.end('Page not found');
        }
    }
}

function socketRoute(socket)
{

    utils.logging.on('info', function(msg)
    {
        socket.emit('log', '[INFO]: ' + msg );
    });

    utils.logging.on('logerror', function(msg)
    {
        socket.emit('log', '[ERROR]: ' + msg );
    });

    utils.logging.on('debug', function(msg)
    {
        socket.emit('log', '[DEBUG]: ' + msg );
    });

    socket.on('config', function(msg)
    {
        utils.config.change('serverChange', querystring.parse(msg));
    });

    if (nconf.getBoolean('dev'))
    {
        socket.packet[socket.id] = function(srcip, srcPort, destip, destPort, msg, info, type,
        startTime)
        {
            hex = msg.toString('hex');
            var json = JSON.stringify({'srcip': srcip, 'destip': destip, 'length': msg.length,
                'info': info + ": 0x" + type, 'realTime': realTime.join("."),
                'time': sinceStartTime.join(".")});
           socket.emit("packetReceive", json);
        }

        packet.on('receive', socket.packet[socket.id]);

        socket.on('getPacketData', function(time)
        {
            socket.emit('packetData', JSON.stringify(packet.get(time)));
        });

        socket.on('databaseClear', function()
        {
            packet.clear();
        });

        socket.on('disconnect', function () {
            packet.removeListener('receive', socket.packet[socket.id]);
        });

    }
}

exports.webserver = webserver;
