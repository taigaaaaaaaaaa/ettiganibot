import { addCoins, getBalance, placeBet } from "../src/casinoStore.js";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from "discord.js";
import { logCasinoEvent } from "../src/casinoLogger.js";

const MINIMUM_BET = 100_000_000;
const MISS_MULTIPLIER = 2;

const symbols = [
    { value: "🍋", weight: 39, payouts: [0, 0, 3, 5] },
    { value: "🍒", weight: 25, payouts: [0, 0, 5, 10] },
    { value: "🔔", weight: 15, payouts: [0, 0, 10, 15] },
    { value: "⭐", weight: 14, payouts: [0, 0, 15, 30] },
    { value: "💣", weight: 10, payouts: [0, 0, -10, -20] },
    { value: "7️⃣", weight: 8, payouts: [0, 0, 30, 50] },
    { value: "☠", weight: 8, payouts: [0, 0, -20, -40] },
    { value: "☢", weight: 5, payouts: [0, 0, -80, -100] },
    { value: "🦀", weight: 12, payouts: [0, 0, 100, 200] }
];

const symbolByValue = new Map(symbols.map(symbol => [symbol.value, symbol]));
const totalWeight = symbols.reduce((total, symbol) => total + symbol.weight, 0);
const MAXIMUM_LOSS_MULTIPLIER = Math.max(
    MISS_MULTIPLIER,
    ...symbols.flatMap(({ payouts }) => payouts.slice(2).filter(multiplier => multiplier < 0).map(Math.abs))
);

function drawSymbol() {
    const target = Math.random() * totalWeight;
    let currentWeight = 0;

    for (const symbol of symbols) {
        currentWeight += symbol.weight;
        if (target < currentWeight) return symbol.value;
    }

    return symbols[0].value;
}

function getPayout(result, bet) {
    const counts = new Map();
    for (const symbol of result) counts.set(symbol, (counts.get(symbol) || 0) + 1);
    const [symbol, count] = [...counts.entries()].find(([, count]) => count >= 2) || [];
    const definition = symbolByValue.get(symbol);

    if (!definition || count < 2) {
        return { amount: bet * -MISS_MULTIPLIER, multiplier: -MISS_MULTIPLIER, label: "はずれ" };
    }

    const multiplier = definition.payouts[count];
    return { amount: bet * multiplier, multiplier, label: `${symbol}${count}つ` };
}

function createContinueButton(userId, gameId, disabled = false) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`ura_slot:continue:${userId}:${gameId}`)
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
    "💣 2つ: -10倍 / 3つ: -20倍\n" +
    "7️⃣ 2つ: 30倍 / 3つ: 50倍\n" +
    "☠ 2つ: -20倍 / 3つ: -40倍\n" +
    "☢ 2つ: -80倍 / 3つ: -100倍\n" +
    "🦀 2つ: 100倍 / 3つ: 200倍";

export const data = {
    name: "ura_slot",
    description: "最低1億ettigani$から回せる裏スロットです",
    options: [
        {
            name: "bet",
            description: "賭けるettigani$（最低1億）",
            type: 4,
            required: true,
            min_value: MINIMUM_BET
        }
    ]
};

export async function execute(interaction) {
    const bet = interaction.options.getInteger("bet");
    const userId = interaction.user.id;
    const guildId = interaction.guildId;

    if (!Number.isSafeInteger(bet) || bet < MINIMUM_BET || !Number.isSafeInteger(bet * MAXIMUM_LOSS_MULTIPLIER)) {
        await interaction.reply({
            content: `ベット額は **${MINIMUM_BET.toLocaleString()} ettigani$** 以上にしてね。`,
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    if (getBalance(guildId, userId) < bet * MAXIMUM_LOSS_MULTIPLIER) {
        await interaction.reply({ content: "コインが足りないよ。最大損失分の残高が必要だよ。", flags: MessageFlags.Ephemeral });
        return;
    }

    const gameId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let message;
    let finished = false;

    const playRound = async () => {
        if (getBalance(guildId, userId) < bet * MAXIMUM_LOSS_MULTIPLIER || !placeBet(guildId, userId, bet)) {
            finished = true;
            await message.edit({ content: "コインが足りないよ。", components: [createContinueButton(userId, gameId, true)] });
            return;
        }

        const result = [drawSymbol(), drawSymbol(), drawSymbol()];
        const payout = getPayout(result, bet);
        if (payout.amount < 0) {
            placeBet(guildId, userId, Math.abs(payout.amount) - bet);
        } else {
            addCoins(guildId, userId, payout.amount);
        }

        const balance = getBalance(guildId, userId);
        logCasinoEvent(interaction, "ura_slot", {
            ベット: `${bet.toLocaleString()} ettigani$`,
            結果: result.join(" "),
            配当: `${payout.multiplier}倍 (${payout.amount.toLocaleString()} ettigani$)`,
            残高: `${balance.toLocaleString()} ettigani$`
        });

        const payoutText = payout.amount > 0
            ? `🎉 ${payout.label}！配当 **${payout.multiplier}倍**（**${payout.amount.toLocaleString()} ettigani$**）！`
            : payout.amount < 0
                ? `💥 ${payout.label}！**${Math.abs(payout.multiplier)}倍** 減額だよ。`
                : "今回ははずれだよ。";

        await message.edit({
            content: `🎰 ${result.join(" | ")}\n${payoutText}\n残高: **${balance.toLocaleString()} ettigani$**`,
            components: [createContinueButton(userId, gameId)]
        });
    };

    const attachCollector = () => {
        const collector = message.createMessageComponentCollector({
            time: 120000,
            filter: component => component.customId === `ura_slot:continue:${userId}:${gameId}`
        });

        collector.on("collect", async component => {
            if (component.user.id !== userId) {
                await component.reply({ content: "この裏スロットは実行した本人だけ続けられます。", flags: MessageFlags.Ephemeral });
                return;
            }

            await component.deferUpdate();
            collector.stop("continued");
            await message.edit({ content: "🎰 裏スロットを回しています...", components: [] });
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

    await interaction.reply({ content: payoutTable });
    message = await interaction.channel.send({ content: "🎰 裏スロットを回しています..." });
    await playRound();
    if (!finished) attachCollector();
}
