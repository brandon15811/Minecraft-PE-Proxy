-- phpMyAdmin SQL Dump
-- version 3.4.10.1deb1
-- http://www.phpmyadmin.net
--
-- Host: localhost
-- Generation Time: Aug 24, 2013 at 04:45 PM
-- Server version: 5.5.31
-- PHP Version: 5.3.10-1ubuntu3.7

SET SQL_MODE="NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";

CREATE DATABASE IF NOT EXISTS proxy;
USE proxy;

--
-- Database: `proxy`
--

-- --------------------------------------------------------

--
-- Table structure for table `clients`
--

CREATE TABLE IF NOT EXISTS `clients` (
  `id` varchar(50) NOT NULL COMMENT 'Port or IP',
  `IP` varchar(50) DEFAULT NULL,
  `port` int(11) DEFAULT NULL,
  `destServerIP` varchar(50) DEFAULT NULL,
  `destServerPort` int(11) DEFAULT NULL,
  `username` varchar(50) DEFAULT NULL,
  `lastTime` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- --------------------------------------------------------

--
-- Table structure for table `servers`
--

CREATE TABLE IF NOT EXISTS `servers` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `IP` varchar(50) NOT NULL,
  `port` int(5) NOT NULL,
  `name` varchar(50) NOT NULL,
  `open` tinyint(1) NOT NULL,
  `currentPlayers` int(11) NOT NULL,
  `maxPlayers` int(11) NOT NULL,
  `lastTime` int(11) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB  DEFAULT CHARSET=latin1  ;
