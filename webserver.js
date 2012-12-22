var app = require('http').createServer(handler);
var io = require('socket.io').listen(app);
var querystring = require('querystring');
var ejs = require('ejs');
var fs = require('fs');
var path = require('path');
var utils = require('./utils');
nconf = utils.config.nconf;

app.listen(8001);

function handler (req, res)
{
  fs.readFile(path.join(__dirname, 'layouts/index.ejs'),
  function (err, data)
  {
    if (err) 
    {
      res.writeHead(500);
      return res.end('Error loading config.');
    }

    res.writeHead(200);
    res.end(ejs.render(data.toString('ascii')));
  });
}

io.set('log level', 2);
io.sockets.on('connection', function (socket)
{

    utils.logging.on('info', function(msg)
    {
        socket.emit('log', '[INFO]: ' + msg );
    });

    utils.logging.on('error', function(msg)
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
});





