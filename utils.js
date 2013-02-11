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
config.nconf.argv().env().file({ file: configPath });

logging.packet = function (msg)
{
    logging.emit('packet', msg);
}

logging.debug = function (msg)
{
    logging.emit('debug', msg);
}

logging.info = function (msg)
{
    logging.emit('info', msg);
}

logging.logerror = function (msg)
{
    logging.emit('logerror', msg);
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

config.nconf.getBoolean = function(key)
{
    return misc.toBoolean(config.nconf.get(key))
}

config.nconf.getInt = function(key)
{
    return parseInt(config.nconf.get(key))
}

exports.logging = logging;
exports.config = config;
exports.misc = misc;
