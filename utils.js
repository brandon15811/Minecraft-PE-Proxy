var EventEmitter = require('events').EventEmitter;
var logging = new EventEmitter();
var config = new EventEmitter();
var path = require('path');
var fs = require('fs');
var misc = this;
var configPath = path.join(__dirname, 'config.json');
config.nconf = require('nconf');
logging.setMaxListeners(50);

//Check if config file exists
if (!fs.existsSync(configPath))
{
    fs.writeFileSync(configPath, '{}');
}

//Read config from command line arguments, environment variables, and the config file
//(each one takes precedence over the next)
//Use '__' seperator for env, since bash doesn't allow ':' in env variables
config.nconf.argv().env({separator: '__'}).file({ file: configPath });

logging.debug = function (msg)
{
    if (checkLogging('debug'))
    {
        logging.emit('debug', msg);
    }
}

logging.info = function (msg)
{
    if (checkLogging('info'))
    {
        logging.emit('info', msg);
    }
}

logging.logerror = function (msg)
{
    if (checkLogging('logerror'))
    {
        logging.emit('logerror', msg);
    }
}

logging.mysql = function (msg)
{
    if (checkLogging('mysql'))
    {
        logging.emit('mysql', msg);
    }
}

config.change = function (event, options)
{
    config.emit(event, options);
}

misc.isNumber = function (n)
{
    return !isNaN(parseFloat(n)) && isFinite(n);
}

misc.toBoolean = function (obj)
{
    if (typeof(obj) !== 'undefined')
    {
        if (obj.toString().toLowerCase() === 'true')
        {
            return true;
        }
    }
    return false;
}

misc.currentTime = function()
{
    return Math.round(new Date().getTime() / 1000);
}

config.nconf.getBoolean = function(key)
{
    return misc.toBoolean(config.nconf.get(key));
}

config.nconf.getInt = function(key)
{
    return parseInt(config.nconf.get(key));
}

function checkLogging(type)
{
    if (config.nconf.getBoolean('logging:' + type) || config.nconf.getBoolean('logging:all'))
    {
        return true;
    }
    return false;
}

exports.logging = logging;
exports.config = config;
exports.misc = misc;
