module.exports = {
  apps: [{
    name: 'biz-insight',
    script: 'node_modules/next/dist/bin/next',
    args: 'start -H 0.0.0.0 -p 3000',
    cwd: '/home/openclaw-ubuntu-zyb/biz-insight-mvp',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    }
  }]
};