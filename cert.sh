#!/bin/sh

# List of IP addresses to use with cert
IP_LIST="localhost 127.0.0.1 ::1 192.168.0.11 192.168.0.10 192.168.1.135 192.168.1.146"

# Make cert dir
mkdir -p .cert

# Make cert + key
mkcert -key-file privkey.pem -cert-file cert.pem $IP_LIST

# Move files to cert dir
mv privkey.pem cert.pem .cert