import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";

export const data = {
    name: "help",
    description: "かにbotの説明を見ることができます"
};

const categories = {
    overview: {
        title: "1. 概要",
        description: [
            "えっちがにbotのコマンド一覧だよ。",
            "数字のボタンを押すと、カテゴリごとの説明を表示します。",
            "毎日、毎週月曜日、月初めの0:00には、えっちがにトップランカーを送信します。"
        ].join("\n")
    },
    ettigani: {
        title: "2. えっちがに系",
        description: [
            "`/gamertag` 登録されているメンバーのMinecraftのゲーマータグを表示します。",
            "`/today` 今日の総えっちがに数を表示します。",
            "`/my_today` 今日の自分のえっちがに数を表示します。",
            "`/weekly` 今週の総えっちがに数を表示します。",
            "`/my_weekly` 今週の自分のえっちがに数を表示します。",
            "`/monthly` 今月の総えっちがに数を表示します。",
            "`/my_monthly` 今月の自分のえっちがに数を表示します。",
            "`/total` 累計の総えっちがに数を表示します。",
            "`/my_total` 累計の自分のえっちがに数を表示します。",
            "`/level` 自分のレベルを表示します。",
            "`/level_rank` レベルのランキングを表示します。",
            "`/next_level` 次のレベルまでに必要なえっちがに数を表示します。"
        ].join("\n")
    },
    casino: {
        title: "3. カジノ系",
        description: [
            "`/balance` ettigani$の残高を表示します。",
            "`/daily` 1日1回、1000 ettigani$を受け取れます。",
            "`/slot` ettigani$を賭けてスロットを回します。",
            "`/highlow` 次の数字がHIGHかLOWかを予想します。",
            "`/blackjack` ettigani$を賭けてブラックジャックをします。"
        ].join("\n")
    },
    voice: {
        title: "4. VC系",
        description: [
            "`/ettigani_join` 現在いるボイスチャンネルで読み上げを開始します。",
            "`/ettigani_leave` 読み上げを終了してボイスチャンネルから退出します。"
        ].join("\n")
    }
};

function createTopButtons(disabled = false) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("help:overview").setLabel("1").setStyle(ButtonStyle.Primary).setDisabled(disabled),
        new ButtonBuilder().setCustomId("help:ettigani").setLabel("2").setStyle(ButtonStyle.Primary).setDisabled(disabled),
        new ButtonBuilder().setCustomId("help:casino").setLabel("3").setStyle(ButtonStyle.Primary).setDisabled(disabled),
        new ButtonBuilder().setCustomId("help:voice").setLabel("4").setStyle(ButtonStyle.Primary).setDisabled(disabled)
    );
}

function createTopEmbed() {
    return new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle("えっちがにbot ヘルプ")
        .setDescription("見たいカテゴリの数字を押してください。")
        .addFields(
            { name: "1. 概要", value: "botの概要と共通案内", inline: true },
            { name: "2. えっちがに系", value: "集計・レベル関連", inline: true },
            { name: "3. カジノ系", value: "ettigani$関連", inline: true },
            { name: "4. VC系", value: "読み上げ関連", inline: true }
        );
}

function createCategoryEmbed(category) {
    return new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle(category.title)
        .setDescription(category.description)
        .setFooter({ text: "TOPへ戻るには下のボタンを押してください。" });
}

export async function execute(interaction) {
    await interaction.reply({
        embeds: [createTopEmbed()],
        components: [createTopButtons()],
        ephemeral: true
    });

    const message = await interaction.fetchReply();
    const collector = message.createMessageComponentCollector({
        time: 300000,
        filter: component => component.customId.startsWith("help:")
    });

    collector.on("collect", async component => {
        if (component.user.id !== interaction.user.id) {
            await component.reply({
                content: "このヘルプを開いた本人だけ操作できます。",
                ephemeral: true
            });
            return;
        }

        if (component.customId === "help:top") {
            await component.update({
                embeds: [createTopEmbed()],
                components: [createTopButtons()]
            });
            return;
        }

        const categoryKey = component.customId.slice("help:".length);
        const category = categories[categoryKey];
        if (!category) return;

        await component.update({
            embeds: [createCategoryEmbed(category)],
            components: [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId("help:top")
                        .setLabel("TOPへ")
                        .setStyle(ButtonStyle.Secondary)
                )
            ]
        });
    });
}