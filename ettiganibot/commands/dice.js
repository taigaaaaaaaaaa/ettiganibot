import { addCoins, getBalance, placeBet } from "../src/casinoStore.js";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from "discord.js";
import { logCasinoEvent } from "../src/casinoLogger.js";

const MINIMUM_BET = 100_000_000;
const WIN_MULTIPLIER = 20;
const LOSS_MULTIPLIER = 5;
const MIN_WIN_MARGIN = 2;

function rollDice() {
    return [1, 2].map(() => Math.floor(Math.random() * 6) + 1);
}

function formatDice(dice) {
    return `${dice.join(" + ")} = ${dice.reduce((total, value) => total + value, 0)}`;
}

function createRollButton(userId, gameId, disabled = false) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`ura_dice:roll:${userId}:${gameId}`)
            .setLabel("ダイスを振る")
            .setStyle(ButtonStyle.Danger)
            .setDisabled(disabled)
    );
}

function createContinueButton(userId, gameId, disabled = false) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`ura_dice:continue:${userId}:${gameId}`)
            .setLabel("続ける")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(disabled)
    );
}

export const data = {
    name: "ura_dice",
    description: "最低1億。ディーラーに2点差以上で勝つと20倍、負けると5倍のダイスゲーム。",
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
    const lossCost = bet * LOSS_MULTIPLIER;

    if (!Number.isSafeInteger(bet) || !Number.isSafeInteger(lossCost) || bet < MINIMUM_BET) {
        await interaction.reply({
            content: `最低ベット額は **${MINIMUM_BET.toLocaleString()} ettigani$** だよ。`,
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    if (getBalance(guildId, userId) < lossCost) {
        await interaction.reply({ content: "コインが足りないよ。最低5億ettigani$いるよ。出直してきな", flags: MessageFlags.Ephemeral });
        return;
    }

    const gameId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let message;
    let finished = false;

    const playRound = async () => {
        if (getBalance(guildId, userId) < lossCost || !placeBet(guildId, userId, bet)) {
            finished = true;
            await message.edit({ content: "コインが足りなくなったため、ゲームを中止したよ。", components: [createContinueButton(userId, gameId, true)] });
            return;
        }

        const playerDice = rollDice();
        const dealerDice = rollDice();
        const playerTotal = playerDice[0] + playerDice[1];
        const dealerTotal = dealerDice[0] + dealerDice[1];
        let payout = 0;
        let result;

        if (playerTotal >= dealerTotal + MIN_WIN_MARGIN) {
            payout = bet * WIN_MULTIPLIER;
            result = `🎉 勝利！ **${payout.toLocaleString()} ettigani$** を獲得！（${WIN_MULTIPLIER}倍）`;
        } else if (playerTotal === dealerTotal) {
            placeBet(guildId, userId, bet * (LOSS_MULTIPLIER - 1));
            result = "引き分け。ベットの5倍を没収だよ。";
        } else if (playerTotal === dealerTotal + 1) {
            placeBet(guildId, userId, bet * (LOSS_MULTIPLIER - 1));
            result = "1点差では勝利にならないよ。ベットの5倍を没収だよ。";
        } else {
            placeBet(guildId, userId, bet * (LOSS_MULTIPLIER - 1));
            result = "ディーラーの勝ち。ベットの5倍を没収だよ。";
        }

        const balance = addCoins(guildId, userId, payout);
        logCasinoEvent(interaction, "ura_dice", {
            ベット: `${bet.toLocaleString()} ettigani$`,
            プレイヤー: formatDice(playerDice),
            ディーラー: formatDice(dealerDice),
            結果: result,
            配当: `${payout.toLocaleString()} ettigani$`,
            残高: `${balance.toLocaleString()} ettigani$`
        });

        await message.edit({
            content: `🎲 あなた: **${formatDice(playerDice)}**\n` +
                `🎲 ディーラー: **${formatDice(dealerDice)}**\n${result}\n` +
                `残高: **${balance.toLocaleString()} ettigani$**`,
            components: [createContinueButton(userId, gameId)]
        });
    };

    const attachRollCollector = () => {
        const collector = message.createMessageComponentCollector({
            time: 120000,
            filter: component => component.customId === `ura_dice:roll:${userId}:${gameId}`
        });

        collector.on("collect", async component => {
            if (component.user.id !== userId) {
                await component.reply({ content: "このダイスは実行した本人だけ振れます。", flags: MessageFlags.Ephemeral });
                return;
            }

            await component.deferUpdate();
            collector.stop("finished");
            await message.edit({ content: "🎲 ダイスを振っています...", components: [] });
            await playRound();
            if (!finished) attachContinueCollector();
        });

        collector.on("end", async (_, reason) => {
            if (reason === "time" && !finished) {
                finished = true;
                await message.edit({ content: "時間切れ。今回のダイスは無効になったよ。", components: [createRollButton(userId, gameId, true)] }).catch(() => {});
            }
        });
    };

    const attachContinueCollector = () => {
        const collector = message.createMessageComponentCollector({
            time: 120000,
            filter: component => component.customId === `ura_dice:continue:${userId}:${gameId}`
        });

        collector.on("collect", async component => {
            if (component.user.id !== userId) {
                await component.reply({ content: "このダイスは実行した本人だけ続けられます。", flags: MessageFlags.Ephemeral });
                return;
            }

            await component.deferUpdate();
            collector.stop("continued");
            await message.edit({ content: "🎲 ダイスを振っています...", components: [] });
            await playRound();
            if (!finished) attachContinueCollector();
        });

        collector.on("end", async (_, reason) => {
            if (reason === "time" && !finished) {
                finished = true;
                await message.edit({ components: [createContinueButton(userId, gameId, true)] }).catch(() => {});
            }
        });
    };

    await interaction.reply({
        content: `🎲 ベット **${bet.toLocaleString()} ettigani$** を受け付けたよ。\n準備ができたらボタンを押してダイスを振ってね。`,
        components: [createRollButton(userId, gameId)]
    });
    message = await interaction.fetchReply();
    attachRollCollector();
}