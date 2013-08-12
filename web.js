var http = require('http');
var crypto = require('crypto');
var fs = require('fs');
var director = require('director');
var formidable = require('formidable');
var utils = require('./utils');
var nconf = utils.config.nconf;
var router = new director.http.Router().configure({before: checkAuth});
var tokenSecret = nconf.get('loadbalancer:tokenSecret');
var web = this;

var server = http.createServer(function (req, res)
{
    utils.logging.debug('URL requested: ' + req.url);

    var form = new formidable.IncomingForm();
    form.parse(req, function(error, fields, files)
    {
        req.fields = fields;
        if (error)
        {
            res.writeHead(500);
            res.end('Internal error');
            return;
        }
        router.dispatch(req, res, function(err)
        {
            if (err)
            {
                res.writeHead(404);
                res.end('Page not found');
            }
        });
    });
});
//Web requests time out at 10 seconds
server.setTimeout(10000);

function checkAuth()
{
    if (!this.req.hasOwnProperty('fields') ||
        !this.req.fields.hasOwnProperty('token') ||
        !this.req.fields.hasOwnProperty('time'))
    {
        this.res.writeHead('401');
        this.res.end('Invalid token');
        return false;
    }
    var token = this.req.fields.token;
    var tokenTime = this.req.fields.time;

    var shasum = crypto.createHash('sha1');
    var hashTime = parseInt(tokenTime);
    shasum.update(tokenSecret + ":" + hashTime + ":" + this.req.connection.remoteAddress);
    var sha1sum = shasum.digest('hex');
    var expiryTime = hashTime + 30;
    if (token === sha1sum && utils.currentTime() < expiryTime)
    {
        return true;
    }
    this.res.writeHead('401');
    this.res.end('Invalid token');
    return false;
}

router.post('/server/:IP/:port/status/:status', function(IP, port, status)
{
    res = this.res;
    if (status !== 'close' && status !== 'open')
    {
        res.writeHead(400);
        res.end('Invalid status');
        return;
    }
    utils.config.emit('changeServerStatus', IP, port, status, function(err, result, rows)
    {
        if (err)
        {
            res.writeHead(500);
            res.end('Internal error');
        }
        else if (result['affectedRows'] === 0)
        {
            res.writeHead(400);
            res.end("No servers found");
        }
        else if (result['affectedRows'] !== 0 && result['changedRows'] === 0)
        {
            res.writeHead(200);
            res.end("Server status already set to " + status )
        }
        else
        {
            res.writeHead(200);
            res.end("Server status changed");
        }
    });
});

router.post('/server/:IP/:port/heartbeat', function(IP, port)
{
    res = this.res;
    utils.config.emit('serverHeartbeat', IP, port, function(err, result)
    {
        if (err)
        {
            res.writeHead(500);
            res.end('Internal error');
        }
        else if (result['affectedRows'] === 0)
        {
            res.writeHead(400);
            res.end("No servers found");
        }
        else
        {
            res.writeHead(200);
            res.end("Heartbeat successful");
        }
    });
});

router.post('/server/refresh', function()
{
    res = this.res;
    utils.config.emit('serverRefresh', function(err, result)
    {
        if (err)
        {
            res.writeHead(500);
            res.end('Internal error');
        }
        else
        {
            res.writeHead(200);
            res.end("Refresh successful");
        }
    });
});
web.start = function()
{
    server.listen(8001, nconf.get('loadbalancer:webIP'), function()
    {
        address = server.address()
        utils.logging.info('Loadbalancer web server listening on ' + address['address'] + ':' + address['port']);
    });
}
exports.web = web;
