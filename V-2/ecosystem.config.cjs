module.exports = {
  apps: [
    {
      name: "Andy's Bot",
      script: 'dist/src/index.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      restart_delay: 3000,
      max_memory_restart: '512M',
      time: true,
      env: { NODE_ENV: 'production' }
    },
    {
      name: 'TTS_API',
      script: '../tts-api/server.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      restart_delay: 3000,
      max_memory_restart: '512M',
      time: true,
      env: { NODE_ENV: 'production' }
    }
  ]
}
