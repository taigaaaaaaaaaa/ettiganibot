import express from "express";

const router = express.Router();

export default (client) => {
  // APIキーチェック
  router.use((req, res, next) => {
    if (req.headers["x-cli-key"] !== process.env.CLI_KEY) {
      return res.status(403).json({ ok: false, error: "APIキーが不正" });
    }
    next();
  });

  // BAN
  router.post("/ban", async (req, res) => {
    const { guildId, userId } = req.body;

    try {
      const guild = await client.guilds.fetch(guildId);
      const member = await guild.members.fetch(userId);

      await member.ban({ reason: "CLIからBAN実行" });
      res.json({ ok: true, message: `${userId} をBANしました` });
    } catch (err) {
      res.json({ ok: false, error: err.message });
    }
  });

  // KICK
  router.post("/kick", async (req, res) => {
    const { guildId, userId } = req.body;

    try {
      const guild = await client.guilds.fetch(guildId);
      const member = await guild.members.fetch(userId);

      await member.kick("CLIからKICK実行");
      res.json({ ok: true, message: `${userId} をKICKしました` });
    } catch (err) {
      res.json({ ok: false, error: err.message });
    }
  });

  return router;
};

