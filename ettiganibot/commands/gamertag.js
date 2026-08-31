import fs from "fs";
import { readJson, dataPath } from "../src/dataPaths.js";

export const data = {
    name: "gamertag",
    description: "サーバーのメンバーのゲーマータグを確認します",
    options: [
        {
            type: 6, // USER
            name: "user",
            description: "誰のゲーマータグを表示しますか？",
            required: true
        }
    ]
};

export async function execute(interaction) {
    const targetUser = interaction.options.getUser("user");

    const gamertags = readJson("gamertag.json", {});

    // 登録されていない場合
    if (!gamertags[targetUser.id]) {
        return interaction.reply({
            content: `ごめんね、この鯖にこの機能はまだ実装されてないみたい。\n実装してほしければたいがにゲーマータグを教えてね！追加するから`,
            ephemeral: true
        });
    }

    // 登録されている場合
    const tag = gamertags[targetUser.id];

    return interaction.reply({
        content: `🎮 <@${targetUser.id}> さんのゲーマータグは **${tag}** です。`,
        ephemeral: true
    });
}