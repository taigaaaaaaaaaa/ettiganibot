import { addCoins, getBalance, placeBet } from "../src/casinoStore.js";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from "discord.js";
import { logCasinoEvent } from "../src/casinoLogger.js";

const MAXIMUM_BET = 50_000_000;
const suits = ["♠", "♥", "♦", "♣"];
const ranks = [
    { label: "A", value: 11 },
    { label: "2", value: 2 },
    { label: "3", value: 3 },
    { label: "4", value: 4 },
    { label: "5", value: 5 },
    { label: "6", value: 6 },
    { label: "7", value: 7 },
    { label: "8", value: 8 },
    { label: "9", value: 9 },
    { label: "10", value: 10 },
    { label: "J", value: 10 },
    { label: "Q", value: 10 },
    { label: "K", value: 10 }
];

function createDeck() {
    return suits.flatMap(suit => ranks.map(rank => ({
        label: `${suit}${rank.label}`,
        value: rank.value,
        isAce: rank.label === "A"
    })));
}

function drawCard(deck) {
    const index = Math.floor(Math.random() * deck.length);
    return deck.splice(index, 1)[0];
}

function getHandValue(hand) {
    let value = hand.reduce((total, card) => total + card.value, 0);
    let aces = hand.filter(card => card.isAce).length;

    while (value > 21 && aces > 0) {
        value -= 10;
        aces--;
    }

    return value;
}

function isBlackjack(hand) {
    return hand.length === 2 && getHandValue(hand) === 21;
}

function formatHand(hand) {
    return hand.map(card => card.label).join(" ");
}

function createButtons(userId, gameId, disabled = false) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`blackjack:hit:${userId}:${gameId}`)
            .setLabel("ヒット")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId(`blackjack:stand:${userId}:${gameId}`)
            .setLabel("スタンド")
            .setStyle(ButtonStyle.Success)
            .setDisabled(disabled)
    );
}

function createContinueButton(userId, gameId, disabled = false) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`blackjack:continue:${userId}:${gameId}`)
            .setLabel("続ける")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(disabled)
    );
}

export const data = {
    name: "blackjack",
    description: "ettigani$を賭けてブラックジャックをします",
    options: [
        {
            name: "bet",
            description: "賭けるettigani$",
            type: 4,
            required: true,
            min_value: 1,
            max_value: MAXIMUM_BET
        }
    ]
};

async function startGame(message, guildId, userId, bet, logContext) {
    const deck = createDeck();
    const player = [drawCard(deck), drawCard(deck)];
    const dealer = [drawCard(deck), drawCard(deck)];
    const gameId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let finished = false;

    const settle = async (message, payout, result) => {
        if (finished) return;
        finished = true;
        const balance = addCoins(guildId, userId, payout);
        logCasinoEvent(logContext, "blackjack", {
            ベット: `${bet} ettigani$`,
            プレイヤー: `${formatHand(player)} (${getHandValue(player)})`,
            ディーラー: `${formatHand(dealer)} (${getHandValue(dealer)})`,
            結果: result,
            配当: `${payout} ettigani$`,
            残高: `${balance} ettigani$`
        });

        await message.edit({
            content: `🃏 あなた: ${formatHand(player)}（${getHandValue(player)}）\n` +
                `ディーラー: ${formatHand(dealer)}（${getHandValue(dealer)}）\n` +
                `${result}\n残高: **${balance} ettigani$**`,
            components: [createContinueButton(userId, gameId)]
        });
        attachContinueCollector();
    };

    const attachContinueCollector = () => {
        const collector = message.createMessageComponentCollector({
            time: 120000,
            filter: component => component.customId === `blackjack:continue:${userId}:${gameId}`
        });

        collector.on("collect", async component => {
            if (component.user.id !== userId) {
                await component.reply({ content: "このブラックジャックは実行した本人だけ続けられます。", flags: MessageFlags.Ephemeral });
                return;
            }

            await component.deferUpdate();
            collector.stop("continued");
            if (!placeBet(guildId, userId, bet)) {
                await component.message.edit({
                    content: "コインが足りないよ。",
                    components: [createContinueButton(userId, gameId, true)]
                });
                return;
            }

            await startGame(component.message, guildId, userId, bet, component);
        });

        collector.on("end", async (_, reason) => {
            if (reason === "time") {
                await message.edit({ components: [createContinueButton(userId, gameId, true)] }).catch(() => {});
            }
        });
    };

    const finishRound = async message => {
        while (getHandValue(dealer) < 17) {
            dealer.push(drawCard(deck));
        }

        const playerValue = getHandValue(player);
        const dealerValue = getHandValue(dealer);
        const dealerBlackjack = isBlackjack(dealer);
        const dealerBust = dealerValue > 21;
        let payout = 0;
        let result;

        if (dealerBlackjack) {
            result = "ディーラーのブラックジャック。はずれだよ。";
        } else if (dealerBust || playerValue > dealerValue) {
            payout = bet * 2;
            result = `🎉 勝利！ **${payout} ettigani$** を獲得！`;
        } else if (playerValue === dealerValue) {
            payout = bet;
            result = "引き分けなのでベットを返却したよ。";
        } else {
            result = "ディーラーの勝ち。はずれだよ。";
        }

        await settle(message, payout, result);
    };

    const playerBlackjack = isBlackjack(player);
    const dealerBlackjack = isBlackjack(dealer);
    if (playerBlackjack || dealerBlackjack) {
        const payout = playerBlackjack && !dealerBlackjack ? Math.floor(bet * 2.5) : playerBlackjack ? bet : 0;
        const result = playerBlackjack && !dealerBlackjack
            ? `🎉 ブラックジャック！ **${payout} ettigani$** を獲得！`
            : playerBlackjack
                ? "お互いブラックジャックなのでベットを返却したよ。"
                : "ディーラーのブラックジャック。はずれだよ。";
        const balance = addCoins(guildId, userId, payout);
        logCasinoEvent(logContext, "blackjack", {
            ベット: `${bet} ettigani$`,
            プレイヤー: `${formatHand(player)} (${getHandValue(player)})`,
            ディーラー: `${formatHand(dealer)} (${getHandValue(dealer)})`,
            結果: result,
            配当: `${payout} ettigani$`,
            残高: `${balance} ettigani$`
        });
        await message.edit({
            content: `🃏 あなた: ${formatHand(player)}（${getHandValue(player)}）\n` +
                `ディーラー: ${formatHand(dealer)}（${getHandValue(dealer)}）\n${result}\n` +
                `残高: **${balance} ettigani$**`,
            components: [createContinueButton(userId, gameId)]
        });
        attachContinueCollector();
        return;
    }

    await message.edit({
        content: `🃏 あなた: ${formatHand(player)}（${getHandValue(player)}）\n` +
            `ディーラー: ${dealer[0].label} ?\n` +
            "ヒットかスタンドを選んでね。",
        components: [createButtons(userId, gameId)]
    });

    const collector = message.createMessageComponentCollector({
        time: 120000,
        filter: component => component.customId.startsWith(`blackjack:`)
    });

    collector.on("collect", async component => {
        const [prefix, action, targetUserId, targetGameId] = component.customId.split(":");
        if (prefix !== "blackjack" || targetUserId !== userId || targetGameId !== gameId) return;

        if (component.user.id !== userId) {
            await component.reply({ content: "このブラックジャックは実行した本人だけ操作できます。", flags: MessageFlags.Ephemeral });
            return;
        }

        await component.deferUpdate();
        if (action === "hit") {
            player.push(drawCard(deck));
            if (getHandValue(player) >= 21) {
                collector.stop("finished");
                if (getHandValue(player) === 21) {
                    await finishRound(message);
                } else {
                    await settle(message, 0, "💥 バースト。はずれだよ。");
                }
                return;
            }

            await message.edit({
                content: `🃏 あなた: ${formatHand(player)}（${getHandValue(player)}）\n` +
                    `ディーラー: ${dealer[0].label} ?\nヒットかスタンドを選んでね。`,
                components: [createButtons(userId, gameId)]
            });
        } else if (action === "stand") {
            collector.stop("finished");
            await finishRound(message);
        }
    });

    collector.on("end", async (_, reason) => {
        if (reason === "time" && !finished) {
            await settle(message, 0, "時間切れ。ベットは没収になったよ。");
        }
    });
}

export async function execute(interaction) {
    const bet = interaction.options.getInteger("bet");
    const userId = interaction.user.id;
    const guildId = interaction.guildId;

    if (!Number.isSafeInteger(bet) || bet < 1 || bet > MAXIMUM_BET) {
        await interaction.reply({ content: "ベット額は1以上5,000万以下の整数にしてね。", flags: MessageFlags.Ephemeral });
        return;
    }

    if (getBalance(guildId, userId) < bet || !placeBet(guildId, userId, bet)) {
        await interaction.reply({ content: "コインが足りないよ。", flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.reply({ content: "🃏 ブラックジャックを準備しています..." });
    const message = await interaction.fetchReply();
    await startGame(message, guildId, userId, bet, interaction);
}
