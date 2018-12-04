echo "deploying to remote machine 139.59.93.218 - sreekar.co \n"

set -e

rm -rf ~/xoxo-multiplayer/xoxo-multiplayer-backend

git clone https://github.com/shksa/xoxo-multiplayer-backend.git ~/xoxo-multiplayer/xoxo-multiplayer-backend

cd ~/xoxo-multiplayer/xoxo-multiplayer-backend

echo "running yarn install"
yarn install

yarn start

