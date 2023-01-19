# make sure shit is running even if power goes down
*/10 * * * * systemd-cat -t "schedule" cd /var/lib/sbth/code; milpa show tick
# do whatever relay tells us to to do because I'll shut down autossh again ...
*/30 * * * * /var/lib/sbth/code/bin/emergency.sh
