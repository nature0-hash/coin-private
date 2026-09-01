#!/bin/bash
# Coin Private: preview keepalive supervisor
# Keeps the production standalone server running on :3000 and respawns on exit.
cd /home/z/my-project
while true; do
  PORT=3000 NODE_ENV=production node .next/standalone/server.js >> /home/z/my-project/preview.log 2>&1
  echo "$(date) server exited ($?), respawning" >> /home/z/my-project/preview.log
  sleep 2
done
