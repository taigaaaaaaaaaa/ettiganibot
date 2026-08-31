module.exports = {
  apps: [
    {
      name: "えっちがにbot二台目",
      script: "main.js",
      instances: 1,
      autorestart: true,
      watch: false,
      stdin: true
    }
  ]
}