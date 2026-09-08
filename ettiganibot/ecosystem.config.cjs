module.exports = {
  apps: [
    {
      name: "えっちがにbot二台目",
      script: "main.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      stdin: true
    }
  ]
}
