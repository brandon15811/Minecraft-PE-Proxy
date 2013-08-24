<?php

/*
__PocketMine Plugin__
name=Minecraft-PE-Proxy Heartbeat
description=Plugin to send heartbeat to proxy, based off of PMRealms plugin by shoghicp
version=0.1
author=brandon15811,shoghicp
class=ProxyHeartbeat
apiversion=9
*/
//Setup: Set env variables serverAddress, proxyAddress, and tokenSecret
//TODO: Better name?
class ProxyHeartbeat implements Plugin
{
    private $api, $server, $config;
    public function __construct(ServerAPI $api, $server = false)
    {
        $this->api = $api;
        $this->server = ServerAPI::request();
        ProxyHeartbeatAPI::set($this);
    }

    public function init()
    {
        $this->config = new Config($this->api->plugin->configPath($this)."config.yml", CONFIG_YAML, array(
            "serverAddress" => getenv('serverAddress'),
            "serverPort" => $this->server->port,
            "proxyAddress" => getenv('proxyAddress'),
            //"proxyPort" => getenv('proxyPort'),
            "tokenSecret" => getenv('tokenSecret')
        ));

        $error = 0;
        if($this->config->get("serverAddress") == "")
        {
            console("[ERROR] [Proxy] Please set your serverIP.");
            ++$error;
        }
        if($this->config->get("serverPort") == "")
        {
            console("[ERROR] [Proxy] Please set your serverPort.");
            ++$error;
        }
        if($this->config->get("proxyAddress") == "")
        {
            console("[ERROR] [Proxy] Please set your proxyAddress.");
            ++$error;
        }
        /*if($this->config->get("proxyPort") == "")
        {
            console("[ERROR] [Proxy] Please set your proxyPort.");
            ++$error;
        }*/
        console($this->server->api->getProperty("white-list"));
        if($error === 0)
        {
            //TODO: Fix time interval
            $this->api->schedule(20 * 20, array($this, "heartbeat"), array(), true);
            $this->api->console->register("proxy", "Control Minecraft-PE-Proxy", array($this, "proxyCommandHandler"));
            $this->api->addHandler("player.quit", array($this, "eventHandler"), 50);
            $this->api->addHandler("player.connect", array($this, "eventHandler"), 50);
            $this->api->addHandler("player.spawn", array($this, "eventHandler"), 50);
            $this->heartbeat();
            console("[INFO] Minecraft-PE-Proxy support enabled!");
        }
        else
        {
            console("[ERROR] Minecraft-PE-Proxy support not enabled. Please configure the plugin properly.");
        }
    }

    public function eventHandler($data, $event)
    {
        switch($event)
        {
            case "player.quit":
            case "player.connect":
            case "player.spawn":
                if ($event === "player.quit")
                {
                    $clients = count($this->server->clients) - 1;
                }
                else
                {
                    $clients = count($this->server->clients);
                }

                if ($clients >= $this->server->maxClients - 1)
                {
                    $this->close();
                }
                else
                {
                    $this->open();
                }
                break;
        }
    }

    public function open()
    {
        $this->request("status/open");
    }

    public function close()
    {
        $this->request("status/close");
    }

    public function heartbeat()
    {
        $this->request("heartbeat");
    }

    public function proxyCommandHandler($cmd, $params, $issuer, $alias)
    {
        $output = "";
        if (($issuer instanceof Player))
        {
            $output .= "This command must be run inside the console";
            return $output;
        }
        switch($params[0])
        {

            case "open":
                $this->open();
                break;

            case "close":
                $this->close();
                break;

            default:
                $output .= "Invalid command";
                break;
        }
        return $output;
    }

    public function request($method)
    {
        if (is_array($method))
        {
            $method = $method[0];
        }
        $currentTime = time();
        $token = sha1($this->config->get('tokenSecret').":".$currentTime.":".$this->config->get("serverAddress"));
        #console('google'.":".$currentTime.":".$this->config->get("serverAddress"));
        $this->api->asyncOperation(ASYNC_CURL_POST, array(
            "url" => "http://".$this->config->get("proxyAddress").":8001/server/".$this->config->get("serverAddress")."/".$this->config->get("serverPort")."/".$method,
            "data" => array(
                "token" => $token,
                "time" => $currentTime,
                "maxPlayers" => $this->server->maxClients,
                "currentPlayers" => count($this->api->player->getAll()),
            ),
        ));
    }

    public function __destruct()
    {
    }

}

//TODO: Change name?
class ProxyHeartbeatAPI
{
    private static $object;

    public static function set(ProxyHeartbeat $plugin)
    {
        if(ProxyHeartbeatAPI::$object instanceof ProxyHeartbeat)
        {
            return false;
        }
        ProxyHeartbeatAPI::$object = $plugin;
    }

    public static function open()
    {
        ProxyHeartbeatAPI::$object->open();
    }

    public static function close()
    {
        ProxyHeartbeatAPI::$object->close();
    }

}
