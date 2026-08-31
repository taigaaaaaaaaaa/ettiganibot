import fs from "fs";

export const data = {
    name: "help",
    description: "かにbotの説明を見ることができます"
};

export async function execute(interaction) {

    const helpText = `
かにbotの説明

このbotは、特定の単語に反応して「えっちがに！！！」と送ったり、
🦀のリアクションを検知して「えっちがに！！！」と送ることができるbotだよ。

/help でこのbotの説明を見ることができます。
/gamertag は、登録されているこの鯖のメンバーのMinecraftのゲーマータグを表示することができます。
/today は、今日の総えっちがに数を表示します。
/my_today は、今日の自分のえっちがに数を表示します。
/weekly は、今週の総えっちがに数を表示します。
/my_weekly は、今週の自分のえっちがに数を表示します。
/monthly は、今月の総えっちがに数を表示します。
/my_monthly は、今月の自分のえっちがに数を表示します。
/total は、累計の総えっちがに数を表示します。
/my_total は、累計の自分のえっちがに数を表示します。
/level は、自分のレベルを表示します。レベルは累計のえっちがに数に応じて上がります。
/level_rank は、レベルのランキングを表示します。
/next_level は、次のレベルまでに必要なえっちがに数を表示します。

また、毎日、毎週月曜日、月初めの0:00にえっちがにトップランカーを送信します。
みなさん上位目指して頑張ってください。

このbotはまだまだ進化していく予定です。
なにか入れてほしい機能などあれば、たいがに言ってください。
よっぽどめんどくさいのじゃない以外作ります。
    `;

    await interaction.reply({
        content: helpText,
        ephemeral: true
    });
}