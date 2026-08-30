module.exports = {
  apps: [{
    name: 'BOT_404',
    script: 'dist/src/index.js',
    cwd: __dirname,
    instances: 1,
    autorestart: true,
    restart_delay: 3000,
    max_memory_restart: '512M',
    time: true,
    env: { NODE_ENV: 'production' }
  }]
}
