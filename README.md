Intelligent DNS
=====================

This is my assignment on how to combine intelligence database with a DNS server to protect users from visiting malicious websites or accessing malicious content.

_Still in progress......_

## Directory Structure

- bench

  DNS benchmark script focused on request speed
- lib

  Components for Intelligent DNS
- server.js

  Main script to start the server daemon

## Finished Parts

- A+AAAA response
- Load threat listings into Redis on startup
- Check for malicious domain records and reject with NXDOMAIN
- Check DNSBL for IP addresses
- Respect DNS TTL values (a.k.a. Implemented DNS cache)

## Items to do

- DNSBL for domain names
- Grab content samples for domains with HTTP(s) endpoint
- Call ClamAV to scan samples
- Handling of more DNS types (MX, SRV, PTR, etc.)
- Find more threat listings source