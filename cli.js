var utils = require('./utils');
var packet = require('./packet').packet;
var cli = this;

cli.start = function()
{
    utils.logging.on('info', function(msg)
    {
        console.info('[INFO]: ', msg);
    });

    utils.logging.on('debug', function(msg)
    {
        console.log('[DEBUG]: ', msg);
    });

    utils.logging.on('mysql', function(msg)
    {
        console.log('[MySQL]: ', msg);
    });

    packet.on('receive', function(srcIP, srcPort, destIP, destPort, msg)
    {
        type = msg.toString('hex').substr(0,2);
        console.log("[PACKET]: received: 0x" + type + " from " + srcIP + ":" + srcPort +
            ", sending : 0x" + type + " to " + destIP + ":" + destPort);
        //console.log(packet.decode(msg));
    });
}

exports.cli = cli;
