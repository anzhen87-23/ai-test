cd /Users/anzhen/publicGit/ai-test/packages/web
npm run build

rsync -rv --exclude='.git' --exclude='node_modules' --delete -e 'ssh -p 22 -o ServerAliveInterval=10 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null' /Users/anzhen/publicGit/ai-test root@39.106.88.210:/root/
