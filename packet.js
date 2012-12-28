//Packet decoding based off of https://github.com/Intyre/MinecraftPE-Dissector/blob/master/mcpe.lua
var utils = require('./utils');
var nconf = utils.config.nconf;
var EventEmitter = require('events').EventEmitter;
var dataName = require('./pstructs/5').protocol;
var packetName = require('./pstructs/packetName').packetName;
var packet = new EventEmitter();
var startTime = process.hrtime();
packet.store = {};

packet.log = function (srcip, srcPort, destip, destPort, msg)
{
    if (nconf.get('dev'))
    {
        type = msg.toString('hex').substr(0,2)
        //Only log these packets
        filter = Array("all");
        if (filter.indexOf(type) !== -1 || filter.indexOf("all") !== -1)
        {
            realTime = process.hrtime();
            sinceStartTime = process.hrtime(startTime);
            packet.store[realTime] = msg;
            packet.setMaxListeners(30)
            packet.emit('receive', srcip, srcPort, destip, destPort, msg,
                packetName["0x" + type], type, realTime, sinceStartTime);
        }
    }
}

packet.decode = function (time)
{
    msg = packet.store[time];
    var data = { };
    if(typeof(msg) === 'undefined')
    {
        data['Error'] = "No data found for this packet. Has the server been restarted since it"
             + " was captured?";
             return data;
    }
    var type = msg.toString('hex').substr(0,2);
    var hex = msg.toString('hex');
    data['Data length'] =  msg.length;
    data['Packet ID'] = "0x" + type;
    switch (type)
    {
        case "02":
            data['Ping ID'] = hex.substr(2, 16);
            data['Magic'] = hex.substr(18, 32);
            break;
        
        case "1c":
            data['Ping ID'] = hex.substr(2, 16);
            data['Server ID'] = hex.substr(18, 16);
            data['Magic'] = hex.substr(34, 32);
            data['Length'] = parseInt(hex.substr(66, 4), 16);
            data['Identifier'] = Buffer(hex.substr(70, 22), 'hex').toString('ascii');
            data['Server Name'] = Buffer(hex.substr(92), 'hex').toString('ascii');
            break;
        
        case "05":
            data['Magic'] = hex.substr(2, 32);
            data['Protocol version'] = hex.substr(34, 2);
            data['Null Payload'] = "";
            break;
        
        case "06":
            data['Magic'] = hex.substr(2, 32);
            data['Server ID'] = hex.substr(34,16);
            data['Server Security'] = hex.substr(50, 2);
            data['MTU Size'] = parseInt(hex.substr(52), 16);
            break;
            
        case "07":
            data['Magic'] = hex.substr(2, 32);
            data['Security + Cookie'] = hex.substr(34, 10);
            data['Server Port'] = parseInt(hex.substr(44, 4), 16);
            data['MTU Size'] = parseInt(hex.substr(48, 4), 16);
            data['Client ID'] = hex.substr(52, 16);
            break;
        
        case "08":
            data['Magic'] = hex.substr(2, 32);
            data['Server ID'] = hex.substr(34, 16);
            data['Client Port'] = parseInt(hex.substr(50, 4), 16);
            data['MTU Size'] = parseInt(hex.substr(54, 4), 16);
            data['Security'] = hex.substr(58, 2);
            break;
        
        case "a0":
            data['Unknown'] = hex.substr(2, 4);
            data['Additional Packet'] = hex.substr(6, 2);
            if (parseInt(hex.substr(6, 2), 16) == 0x01)
            {
                data['Packet Number'] = new Buffer(hex.substr(8), 'hex').readUInt16LE(0);
            }
            else
            {
                //TODO: Append to Info column
                data['Multiple nacks'] = {};
                data['Multiple nacks']['First Packet number'] = new Buffer(hex.substr(8, 6),
                    'hex').readUInt16LE(0);
                data['Multiple nacks']['Second Packet Number'] = new Buffer(hex.substr(14, 6),
                    'hex').readUInt16LE(0);
            }
            break;
            
        case "c0":
            data['Unknown'] = hex.substr(2, 4);
            data['Additional Packet'] = hex.substr(6, 2);
            if (parseInt(hex.substr(6, 2), 16) == 0x01)
            {
                data['Packet Number'] = new Buffer(hex.substr(8), 'hex').readUInt16LE(0);
            }
            else
            {
                //TODO: Append to Info column
                data['Multiple acks'] = {};
                data['Multiple acks']['First Packet number'] = new Buffer(hex.substr(8, 6),
                    'hex').readUInt16LE(0);
                data['Multiple acks']['Second Packet Number'] = new Buffer(hex.substr(14, 6),
                    'hex').readUInt16LE(0);
            }
            break;
            
    }
    //data['hexdump'] = "<pre>" + hexy.hexy(msg) + "</pre>";
    return data;
}
exports.packet = packet;
