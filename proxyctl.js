var crypto = require('crypto');
var request = require('request');
var director = require('director');
var utils = require('./utils');
var nconf = utils.config.nconf;
var router = new director.cli.Router();
var tokenSecret = nconf.get('loadbalancer:tokenSecret');

var shasum = crypto.createHash('sha1');

var currentTime = utils.currentTime();

var proxyIP = '127.0.0.1';
var proxyPort = 8001;

shasum.update(tokenSecret + ":" + currentTime + ":" + proxyIP);
sha1sum = shasum.digest('hex');
var formData = {'token': sha1sum, 'time': currentTime};

router.on("refresh", function()
{
    request.post('http://' + proxyIP + ':' + proxyPort + '/server/refresh',
        { 'form': formData }, requestCallback);
});

router.on('status :status :IP :port', function(status, IP, port)
{
        request.post('http://' + proxyIP + ':' + proxyPort + '/server/' + IP + '/' + port + '/status/' + status,
            { 'form': formData }, requestCallback);
});

function requestCallback(error, response, body) {
    if (error)
    {
        console.log(error);
    }
    console.log(body);
}

router.dispatch('on', process.argv.slice(2).join(' '));
