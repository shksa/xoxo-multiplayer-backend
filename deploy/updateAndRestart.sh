echo "deploying to remote machine 139.59.93.218 - sreekar.co \n"

set -e

echo "deleting the old version of repo"
rm -rf ~/xoxo-multiplayer/xoxo-multiplayer-backend

echo "cloning the new version of repo"
git clone git@github.com:shksa/xoxo-multiplayer-backend.git ~/xoxo-multiplayer/xoxo-multiplayer-backend

echo "cd'ing into the repo location"
cd ~/xoxo-multiplayer/xoxo-multiplayer-backend

echo "running yarn install"
yarn install

echo "starting the app with pm2 as a daemon"
yarn start

