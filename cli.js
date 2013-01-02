var utils = require('./utils');
var packet = require('./packet').packet;
var cli = this;

cli.start = function()
{
    utils.logging.on('info', function(msg)
    {
        console.info('[INFO]: ' + msg);
    });

    utils.logging.on('debug', function(msg)
    {
        console.log('[DEBUG]: ' + msg);
    });

    packet.on('receive', function(srcip, srcPort, destip, destPort, msg)
    {
        type = msg.toString('hex').substr(0,2);
        console.log("[PACKET]: received: 0x" + type + " from " + srcip + ":" + srcPort + 
            ", sending : 0x" + type + " to " + destip + ":" + destPort);
    });
}

exports.cli = cli;
