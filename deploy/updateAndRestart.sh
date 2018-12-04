echo "deploying to remote machine 139.59.93.218 - sreekar.co \n"

set -e

echo "deleting the old version of repo"
rm -rf ~/xoxo-multiplayer/xoxo-multiplayer-backend

echo "cloning the new version of repo"
git clone git@github.com:shksa/xoxo-multiplayer-backend.git ~/xoxo-multiplayer/xoxo-multiplayer-backend

echo "Stopping pm2 daemon and all other node apps managed by it (the node apps are also deleted from the process list)"
pm2 kill 

echo "Starting the pm2 daemon"
pm2 status

echo "cd'ing into the repo location"
cd ~/xoxo-multiplayer/xoxo-multiplayer-backend

echo "running yarn install"
yarn install

echo "starting the app with pm2 as a daemon"
yarn start

