import { registerGuildCommands } from "./commandLoader.js";

// 新規サーバー参加時の初期化処理
export async function handleGuildCreate(guild) {
    console.log(`📌 新しいサーバーに参加しました: ${guild.name} (${guild.id})`);

    await registerGuildCommands(guild);

    if (!guild.members.me) {
        console.log("❌ guild.members.me を取得できませんでした");
        return;
    }

    const channel = guild.channels.cache.find(
        ch => ch.isTextBased() && ch.permissionsFor(guild.members.me).has("SendMessages")
    );

    if (!channel) {
        console.log("❌ メッセージを送信できるチャンネルがありません");
    } else {
        const embed = {
            color: 0xff66aa,
            title: "🎉 えっちがにbotを導入していただき、ありがとうございます！",
            description:
                "まずは **/setting** で通知先のチャンネルを設定してください！(管理者限定)\n\n" +
                "設定が完了すると、デイリー・週間・月間ランキングが自動で送信されます。\n\n" +
                "設定が終わり次第 **/help** でコマンド一覧をご覧ください。",
            footer: {
                text: "えっちがにbotへようこそ✨"
            }
        };

        await channel.send({ embeds: [embed] });
        console.log(`✔ ウェルカムメッセージを送信しました: ${guild.name}`);
    }

}
