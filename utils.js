var EventEmitter = require('events').EventEmitter;
var logging = new EventEmitter();
var config = new EventEmitter();
var misc = this;
config.nconf = require('nconf');
logging.setMaxListeners(50);

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

exports.logging = logging;
exports.config = config;
exports.misc = misc;
