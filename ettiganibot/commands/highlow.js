import { addCoins, getBalance, placeBet } from "../src/casinoStore.js";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from "discord.js";
import { logCasinoEvent } from "../src/casinoLogger.js";

const MAXIMUM_BET = 50_000_000;
function createContinueButton(userId, gameId, disabled = false) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`highlow:continue:${userId}:${gameId}`)
            .setLabel("続ける")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(disabled)
    );
}

function createGuessButtons(userId, gameId, disabled = false) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`highlow:guess:high:${userId}:${gameId}`)
            .setLabel("HIGH")
            .setStyle(ButtonStyle.Success)
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId(`highlow:guess:low:${userId}:${gameId}`)
            .setLabel("LOW")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(disabled)
    );
}

export const data = {
    name: "highlow",
    description: "次の数字が高いか低いかを予想します",
    options: [
        {
            name: "bet",
            description: "賭けるettigani$",
            type: 4,
            required: true,
            min_value: 1,
            max_value: MAXIMUM_BET
        },
        {
            name: "guess",
            description: "次の数字が高いか低いか",
            type: 3,
            required: true,
            choices: [
                { name: "HIGH（高い）", value: "high" },
                { name: "LOW（低い）", value: "low" }
            ]
        }
    ]
};

export async function execute(interaction) {
    const bet = interaction.options.getInteger("bet");
    const guess = interaction.options.getString("guess");
    const userId = interaction.user.id;
    const guildId = interaction.guildId;

    if (!Number.isSafeInteger(bet) || bet < 1 || bet > MAXIMUM_BET) {
        await interaction.reply({ content: "ベット額は1以上5,000万以下の整数にしてね。", flags: MessageFlags.Ephemeral });
        return;
    }

    if (getBalance(guildId, userId) < bet) {
        await interaction.reply({ content: "コインが足りないよ。", flags: MessageFlags.Ephemeral });
        return;
    }

    const gameId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let message;
    let finished = false;

    const playRound = async roundGuess => {
        if (!placeBet(guildId, userId, bet)) {
            finished = true;
            await message.edit({
                content: "コインが足りないよ。",
                components: [createContinueButton(userId, gameId, true)]
            });
            return;
        }

        const current = Math.floor(Math.random() * 13) + 1;
        const next = Math.floor(Math.random() * 13) + 1;
        const outcome = next > current ? "high" : next < current ? "low" : "tie";
        const payout = outcome === "tie" ? bet : outcome === roundGuess ? bet * 2 : 0;
        const balance = addCoins(guildId, userId, payout);
        logCasinoEvent(interaction, "highlow", {
            ベット: `${bet} ettigani$`,
            予想: roundGuess,
            結果: `${current} -> ${next} (${outcome})`,
            配当: `${payout} ettigani$`,
            残高: `${balance} ettigani$`
        });
        const resultMessage = outcome === "tie"
            ? "同じ数字だったのでベットを返却したよ。"
            : outcome === guess
                ? `🎉 的中！ **${payout} ettigani$** を獲得！`
                : "はずれだよ。";

        await message.edit({
            content: `🎲 ${current} → ${next}\n${resultMessage}\n残高: **${balance} ettigani$**`,
            components: [createContinueButton(userId, gameId)]
        });
    };

    const attachCollector = () => {
        const collector = message.createMessageComponentCollector({
            time: 120000,
            filter: component => component.customId.startsWith(`highlow:continue:${userId}:`)
        });

        collector.on("collect", async component => {
            if (component.user.id !== userId) {
                await component.reply({ content: "このハイローは実行した本人だけ続けられます。", flags: MessageFlags.Ephemeral });
                return;
            }

            await component.deferUpdate();
            collector.stop("continued");
            await chooseGuess();
        });

        collector.on("end", async (_, reason) => {
            if (reason === "time" && !finished) {
                finished = true;
                await message.edit({ components: [createContinueButton(userId, gameId, true)] }).catch(() => {});
            }
        });
    };

    const chooseGuess = async () => {
        await message.edit({
            content: "HIGHかLOWを選んでね。",
            components: [createGuessButtons(userId, gameId)]
        });

        const collector = message.createMessageComponentCollector({
            time: 120000,
            filter: component => component.customId.startsWith(`highlow:guess:`)
        });

        collector.on("collect", async component => {
            const [prefix, gameType, selectedGuess, targetUserId, targetGameId] = component.customId.split(":");
            if (prefix !== "highlow" || gameType !== "guess" || targetUserId !== userId || targetGameId !== gameId) return;

            if (component.user.id !== userId) {
                await component.reply({ content: "このハイローは実行した本人だけ選択できます。", flags: MessageFlags.Ephemeral });
                return;
            }

            await component.deferUpdate();
            collector.stop("selected");
            await playRound(selectedGuess);
            if (!finished) attachCollector();
        });

        collector.on("end", async (_, reason) => {
            if (reason === "time" && !finished) {
                finished = true;
                await message.edit({ components: [createGuessButtons(userId, gameId, true)] }).catch(() => {});
            }
        });
    };

    await interaction.reply({ content: "🎲 ハイローを準備しています..." });
    message = await interaction.fetchReply();
    await playRound(guess);
    if (!finished) attachCollector();
}
