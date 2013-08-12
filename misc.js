//Didn't want to have to delete this stuff
    if ("06" === type)
    {
        serverID = msg.toString('hex').substr(34, 16);
        console.log("Server ID: " + serverID);
    }
    if ("07" === type)
    {
        var packetID = "08";
        var packetMagic = "00ffff00fefefefefdfdfdfd12345678";
        var packetPort = ("0000" + rinfo.port.toString(16)).slice(-4);
        var packetMTU = ("0000" + (1492).toString(16)).slice(-4);
        var packett = new Buffer(packetID + packetMagic + serverID + packetPort + packetMTU + "00", 'hex');
        //console.log(packetID + "|" + packetMagic + "|" + serverID + "|" + packetPort + "|" + packetMTU + "|" + "00");
        console.log((packetID + packetMagic + serverID + packetPort + packetMTU + "00").length);
        console.log(packetPort);
        //("0800ffff00fefefefefdfdfdfd12345678ffffffffc0ce8a0ac50105b800",'hex');
        client.send(msg, 0, msg.length, serverPort, serverIP);
        client.send(packett, 0, packett.length, rinfo.port, rinfo.address);
        console.log("Sending special 0x08 packet to " + rinfo.address + ":" + rinfo.port);
    }
