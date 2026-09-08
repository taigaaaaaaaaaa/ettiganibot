import { addCoins, getBalance, placeBet } from "../src/casinoStore.js";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { logCasinoEvent } from "../src/casinoLogger.js";

const symbols = [
    { value: "🍋", weight: 35 },
    { value: "🍒", weight: 25 },
    { value: "🔔", weight: 15 },
    { value: "⭐", weight: 14 },
    { value: "7️⃣", weight: 10 },
    { value: "🦀", weight: 5 }
];

function drawSymbol() {
    const target = Math.random() * 100;
    let total = 0;

    for (const symbol of symbols) {
        total += symbol.weight;
        if (target < total) return symbol.value;
    }

    return symbols[0].value;
}

function getPayout(result, bet) {
    const [first, second, third] = result;
    const multipliers = {
        "🍋": { 2: 3, 3: 5 },
        "🍒": { 2: 5, 3: 10 },
        "🔔": { 2: 10, 3: 15 },
        "⭐": { 2: 15, 3: 30 },
        "7️⃣": { 2: 30, 3: 50 },
        "🦀": { 2: 50, 3: 100 }
    };
    const counts = result.reduce((map, symbol) => {
        map[symbol] = (map[symbol] || 0) + 1;
        return map;
    }, {});
    const symbol = Object.keys(counts).find(value => counts[value] >= 2);
    const count = symbol ? counts[symbol] : 0;

    if (symbol && count >= 2) {
        const multiplier = multipliers[symbol][count];
        return { amount: bet * multiplier, multiplier, label: `${symbol}${count}つ` };
    }

    return { amount: 0, multiplier: 0, label: "はずれ" };
}

function createContinueButton(userId, gameId, disabled = false) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`slot:continue:${userId}:${gameId}`)
            .setLabel("続ける")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(disabled)
    );
}

const payoutTable =
    "📋 配当表\n" +
    "🍋 2つ: 3倍 / 3つ: 5倍\n" +
    "🍒 2つ: 5倍 / 3つ: 10倍\n" +
    "🔔 2つ: 10倍 / 3つ: 15倍\n" +
    "⭐ 2つ: 15倍 / 3つ: 30倍\n" +
    "7️⃣ 2つ: 30倍 / 3つ: 50倍\n" +
    "🦀 2つ: 50倍 / 3つ: 100倍";

export const data = {
    name: "slot",
    description: "ettigani$を賭けてスロットを回します",
    options: [
        {
            name: "bet",
            description: "賭けるettigani$",
            type: 4,
            required: true,
            min_value: 1
        }
    ]
};

export async function execute(interaction) {
    const bet = interaction.options.getInteger("bet");
    const userId = interaction.user.id;
    const guildId = interaction.guildId;

    if (!Number.isSafeInteger(bet) || bet < 1) {
        await interaction.reply({ content: "ベット額は1以上の整数にしてね。", ephemeral: true });
        return;
    }

    const gameId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let message;
    let finished = false;

    const playRound = async () => {
        if (!placeBet(guildId, userId, bet)) {
            finished = true;
            await message.edit({
                content: "コインが足りないよ。",
                components: [createContinueButton(userId, gameId, true)]
            });
            return;
        }

        const result = [drawSymbol(), drawSymbol(), drawSymbol()];
        const payout = getPayout(result, bet);
        const balance = addCoins(guildId, userId, payout.amount);
        logCasinoEvent(interaction, "slot", {
            ベット: `${bet} ettigani$`,
            結果: result.join(" "),
            配当: `${payout.multiplier}倍 (${payout.amount} ettigani$)`,
            残高: `${balance} ettigani$`
        });
        const payoutText = payout.amount > 0
            ? `\n🎉 ${payout.label}！配当 **${payout.multiplier}倍**（**${payout.amount} ettigani$**）！`
            : "\n今回ははずれだよ。配当 **0倍**。";

        await message.edit({
            content: `🎰 ${result.join(" | ")}${payoutText}\n残高: **${balance} ettigani$**`,
            components: [createContinueButton(userId, gameId)]
        });
    };

    const attachCollector = () => {
        const collector = message.createMessageComponentCollector({
            time: 120000,
            filter: component => component.customId.startsWith(`slot:continue:${userId}:`)
        });

        collector.on("collect", async component => {
            if (component.user.id !== userId) {
                await component.reply({ content: "このスロットは実行した本人だけ続けられます。", ephemeral: true });
                return;
            }

            await component.deferUpdate();
            collector.stop("continued");
            await message.edit({
                content: "🎰 スロットを回しています...",
                components: []
            });
            await playRound();
            if (!finished) attachCollector();
        });

        collector.on("end", async (_, reason) => {
            if (reason === "time" && !finished) {
                finished = true;
                await message.edit({ components: [createContinueButton(userId, gameId, true)] }).catch(() => {});
            }
        });
    };

    if (getBalance(guildId, userId) < bet) {
        await interaction.reply({ content: "コインが足りないよ。", ephemeral: true });
        return;
    }

    await interaction.reply({ content: payoutTable });
    message = await interaction.channel.send({ content: "🎰 スロットを回しています..." });
    await playRound();
    if (!finished) attachCollector();
}
