//Packet decoding based off of https://github.com/Intyre/MinecraftPE-Dissector/blob/master/mcpe.lua
var utils = require('./utils');
var nconf = utils.config.nconf;
var EventEmitter = require('events').EventEmitter;
var dataName = require('./pstructs/5').protocol;
var packetName = require('./pstructs/packetName').packetName;
var sqlite3 = require('sqlite3');
var packet = new EventEmitter();
var startTime = process.hrtime();
var packetInfo = {};
var stmt;

try
{
    require('console-trace')({
        always: true,
        cwd: __dirname
    })
}
catch(err)
{}

packet.setMaxListeners(50);
var db = new sqlite3.Database('packets.db');
db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='packets'", function(err, row) {
    db.serialize(function() {
        if (typeof(row) === 'undefined')
        {
            db.run("CREATE TABLE packets (srcip TEXT, srcPort INTEGER, destip TEXT, destPort"
                + "INTEGER, msg BLOB, packetName TEXT, type TEXT, realTime TEXT, "
                + "sinceStartTime TEXT)");
        }
        stmt = db.prepare("INSERT INTO packets VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    });
    
});



packet.log = function (srcip, srcPort, destip, destPort, msg)
{
    if (nconf.getBoolean('dev'))
    {
        type = msg.toString('hex').substr(0,2)
        //Only log these packets
        filter = Array("all");
        if (filter.indexOf(type) !== -1 || filter.indexOf("all") !== -1)
        {
            realTime = process.hrtime();
            sinceStartTime = process.hrtime(startTime);
            packet.store(srcip, srcPort, destip, destPort, msg,
                packetName["0x" + type], type, realTime, sinceStartTime);
            packet.emit('receive', srcip, srcPort, destip, destPort, msg,
                packetName["0x" + type], type, realTime, sinceStartTime);
        }
    }
}

packet.store = function (srcip, srcPort, destip, destPort, msg, packetName, type, realTime,
    sinceStartTime)
{
    stmt.run(srcip, srcPort, destip, destPort, msg.toString('hex'), packetName, type,
        realTime.join("."), sinceStartTime.join("."));
}

packet.get = function (time)
{
    db.get("SELECT * FROM packets WHERE realTime = ?", time, function(err, row) {
        try
        {
            packetInfo = packet.decode(new Buffer(row['msg'], 'hex'));
        }
        catch (err)
        {
            packetInfo["Errorr"] = "Packet decoding failed. Try again.";
        }
    });
    return packetInfo;
}

packet.decode = function (msg)
{
    var data = {};
    if(typeof(msg) === 'undefined')
    {
        data['Error'] = "No data found for this packet. Maybe the database was cleared?";
             return data;
    }
    var type = new Buffer(msg.substr(0,1)).readUInt8(0);
    var hex = msg;
    data['Data length'] =  msg.length;
    data['Packet ID'] = "0x" + msg.substr(0,1).toString('hex');
    
    switch (type)
    {
        case 0x02:
            data['Ping ID'] = hex.substr(1, 8).toString('hex');
            data['Magic'] = hex.substr(9, 16).toString('hex');
            break;
        
        case 0x1c:
            data['Ping ID'] = hex.substr(1, 8).toString('hex');
            data['Server ID'] = hex.substr(9, 8).toString('hex');
            data['Magic'] = hex.substr(17, 16).toString('hex');
            data['Length'] = hex.substr(33, 2).readUInt16BE(0);
            data['Identifier'] = hex.substr(35, 11).toString('ascii');
            data['Server Name'] = hex.substr(46).toString('ascii');
            break;
        
        case 0x05:
            data['Magic'] = hex.substr(1, 16).toString('hex')
            data['Protocol version'] = hex.substr(17, 1).toString('hex')
            data['Null Payload'] = "";
            break;
        
        case 0x06:
            data['Magic'] = hex.substr(1, 16).toString('hex')
            data['Server ID'] = hex.substr(17, 8).toString('hex')
            data['Server Security'] = hex.substr(25, 1).toString('hex')
            data['MTU Size'] = hex.substr(26).readUInt16BE(0);
            break;
            
        case 0x07:
            data['Magic'] = hex.substr(1, 16).toString('hex')
            data['Security + Cookie'] = hex.substr(17, 5).toString('hex')
            data['Server Port'] = hex.substr(22, 2).readUInt16BE(0);
            data['MTU Size'] = hex.substr(24, 2).readUInt16BE(0);
            data['Client ID'] = hex.substr(26, 8).toString('hex')
            break;
        
        case 0x08:
            data['Magic'] = hex.substr(1, 16).toString('hex')
            data['Server ID'] = hex.substr(17, 8).toString('hex')
            data['Client Port'] = hex.substr(25, 2).readUInt16BE(0);
            data['MTU Size'] = hex.substr(27, 2).readUInt16BE(0);
            data['Security'] = hex.substr(29, 1).toString('hex')
            break;
        
        case 0xa0:
            data['Unknown'] = hex.substr(1, 2).toString('hex')
            data['Additional Packet'] = hex.substr(3, 1).toString('hex')
            if (hex.substr(3, 1).readUInt8(0) == 0x01)
            {
                data['Packet Number'] = hex.substr(4).readUInt16LE(0);
            }
            else
            {
                //TODO: Append to Info column
                data['Multiple nacks'] = {};
                data['Multiple nacks']['First Packet number'] = hex.substr(4, 3).readUInt16LE(0);
                data['Multiple nacks']['Second Packet Number'] = hex.substr(7, 3).readUInt16LE(0);
            }
            break;
            
        case 0xc0:
            data['Unknown'] = hex.substr(1, 2).toString('hex')
            data['Additional Packet'] = hex.substr(3, 1).toString('hex')
            if (hex.substr(3, 1).readUInt8(0) == 0x01)
            {
                data['Packet Number'] = hex.substr(4).readUInt16LE(0);
            }
            else
            {
                //TODO: Append to Info column
                data['Multiple acks'] = {};
                data['Multiple acks']['First Packet number'] = hex.substr(4, 3).readUInt16LE(0);
                data['Multiple acks']['Second Packet Number'] = hex.substr(7, 3).readUInt16LE(0);
            }
            break;

        case checkData(type):
            data['Packet Number'] = new Buffer(hex.substr(1, 3), 'hex').readUInt16LE(0);
            var subData = hex.substr(4);
            var length = (subData.length) / 8;
            packet.packetLength = 0;
            var i = 0;
            var total = 0;
            data['Packet ' + total] = {};
            dataTotal = data['Packet ' + total];
            
            while (i < length)
            {
                iS = i
                idp = subData.substr(i, 1).readUInt8(0);
                i = i + 1
                try
                {
                    packet.packetLength = subData.substr(i, 2).readUInt16BE(0) / 8;
                }
                catch(err)
                {
                    data['Error'] = "Data packet decoding failed: " + err + " Maybe this packet"
                    + "isn't implemented yet?"
                    break;
                }
                i = i + 2
                
                if (idp === 0x00)
                {
                }
                else if (idp === 0x40)
                {
                    i = i + 3
                }
                else if (idp === 0x60)
                {
                    i = i + 14
                }
                iX = i
                switch(subData.substr(i, 1).readUInt8(0))
                {
                    case 0x82:
                        dataTotal['LoginPacket'] = {};
                        part = dataTotal['LoginPacket']
                        i = dataStart(part, subData, iS, idp);
                        
                        i = getString(part, subData, i, "Name");
                        i = getInt(part, subData, i, "Int 1");
                        i = getInt(part, subData, i, "Int 2")
                        break;
                        
                    case 0x83:
                        dataTotal['LoginStatusPacket'] = {};
                        part = dataTotal['LoginStatusPacket'];
                        i = dataStart(part, subData, iS, idp);
                        
                        i = getInt(part, subData, i, "Int 1");
                        break;
                    default:
                        data['Error'] = "Data packet type not implemented yet."
                        i = length;
                    
                }
            i = iX + packet.packetLength;
            total = total + 1;
            }
            break;
    }
    return data;
}

function getString(part, subData, i, name)
{
    var slength = subData.substr(i, 2).readUInt16BE(0);
    part['Length'] = slength;
    part[name] = subData.substr(i + 2, slength).toString('ascii');
    i = i + slength + 2
    return i;
}

function dataStart(part, subData, i, idp)
{
    part['Container'] = subData.substr(i, 1).toString('hex');
    part['Data Length'] = packet.packetLength;
    if (subData.substr(i, 1).readUInt8(0) === 0x00)
    {
        i = i + 3
    }
    else if (subData.substr(i, 1).readUInt8(0) === 0x40)
    {
        part['Packet Counter'] = subData.substr(i + 3, 3).readUInt16LE(0);
        i= i + 6
    }
    else if (subData.substr(i, 1).readUInt8(0) === 0x60)
    {
        part['Packet Counter'] = subData.substr((i) + 3, 3).readUInt16LE(0);
        part['Unknown'] = subData.substr(i + 6, 4).readUInt16LE(0);
        i = i + 10
    }
    part['MCPE ID'] = subData.substr(i, 1).toString('hex');
    return i + 1;
}

function getMobName(part, subData, i)
{
    //FIXME
    var a = parseInt(subData.substr(i * 2, 8), 16);
    var name = "Unknown name";
    switch (a)
    {
        case 0x20:
            name = "Zombie";
            break;
        
        case 0x21:
            name = "Creeper";
            break;
            
        case 0x22:
            name = "Skeleton";
            break;
            
        case 0x23:
            name = "Spider";
            break;
            
        case 0x24:
            name = "Zombie Pigman";
            break;
    }
    
    part['Mob Type'] = name;
    return i + 8;
}

function getByte(part, subData, i, name)
{
    part[name] = subData.substr(i, 1);
    return i + 1;
}

function getInt(part, subData, i, name)
{
    part[name] = subData.substr(i, 4).readUInt32BE(0);
    return i + 4;
}

function checkData(type)
{
    if (type >= 0x80 && type <= 0x8f)
    {
        return type;
    }
    return false;
}

Buffer.prototype.substr = function (start, length)
{
    buffer = this;
    if (typeof(length) === 'undefined')
    {
        return new Buffer(Array.prototype.slice.call(buffer, start));
    }
    else
    {
        return new Buffer(Array.prototype.slice.call(buffer, start, start + length));
    }
}
exports.packet = packet;
