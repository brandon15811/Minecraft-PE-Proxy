var EventEmitter = require('events').EventEmitter;
var logging = new EventEmitter();
var decode = this;
var config = new EventEmitter();
config.nconf = require('nconf');

logging.debug = function (msg)
{
    logging.emit('debug', msg);
}

logging.info = function (msg)
{
    logging.emit('info', msg);
}

logging.error = function (msg)
{
    logging.emit('error', msg);
}

decode.packetLog = function (srcip, srcPort, destip, destPort, packet)
{
    type = packet.toString('hex').substr(0,2)
    //Only log these packets
    filter = Array("all");
    if (filter.indexOf(type) !== -1 || filter.indexOf("all") !== -1)
    {
        logging.debug("received: 0x" + type + " from " + srcip + ":" + srcPort + 
            ", sending : 0x" + type + " to " + destip + ":" + destPort);
    }
}

config.change = function (event, options)
{
    config.emit(event, options);
}

exports.logging = logging;
exports.decode = decode;
exports.config = config;
