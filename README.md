Minecraft-PE-Proxy
==================

Proxy for Minecraft Pocket Edition to connect to internet servers without app modification

Usage
=====
Before first use
----------------
Install dependencies
```
npm install -d
```
Running the proxy
-----------------
```
node mcpeproxy.js --serverip <server ip>
```
Where `<server ip>` is the ip of the server to connect to
The ip will be saved into the config file
(Also can be specified via the environment variable "serverip")

More detailed documentation will be added when this is more complete
