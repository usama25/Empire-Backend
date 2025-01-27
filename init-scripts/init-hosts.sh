#!/bin/bash

# Path to your hosts file
ETC_HOSTS=/etc/hosts

# Default IP for hostname
IP="127.0.0.1"

echo "Creating host entries for local db cluster..."

# To add hostname in hosts file
addhost() {
  HOSTNAME=$1

  HOSTS_LINE="$IP\t$HOSTNAME"
  if [ -n "$(grep $HOSTNAME $ETC_HOSTS)" ]
    then
      echo "$HOSTNAME already exists : $(grep $HOSTNAME $ETC_HOSTS)"
    else
      echo "Adding $HOSTNAME to your $ETC_HOSTS";
      sudo -- sh -c -e "echo '$HOSTS_LINE' >> $ETC_HOSTS";

      if [ -n "$(grep $HOSTNAME $ETC_HOSTS)" ]
        then
          echo "$HOSTNAME added succesfully $(grep $HOSTNAME $ETC_HOSTS)";
        else
          echo "Failed to Add $HOSTNAME, Try again!";
      fi
  fi
}

# Add hostnames for Mongo DB containers
addhost eg-backend-mongo-rs0
addhost eg-backend-mongo-rs1
addhost eg-backend-mongo-rs2