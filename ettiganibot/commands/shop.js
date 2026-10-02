import { EmbedBuilder, PermissionsBitField, MessageFlags } from "discord.js";
import { addCoins, getBalance, placeBet } from "../src/casinoStore.js";
import { getGuildShopRoleIds, getOrCreateShopRole } from "../src/roleShopStore.js";
import { logCasinoEvent } from "../src/casinoLogger.js";

const SHOP_ITEMS = [
    { id: "kani_brown", name: "カニ見習い", roleName: "🦀 カニ見習い", color: 0xA85D32, price: 100_000 },
    { id: "ocean_blue", name: "深海ブルーがに", roleName: "🦀 深海ブルーがに", color: 0x2471A3, price: 10_000_000 },
    { id: "crab_red", name: "えっちがにレッド", roleName: "🦀 えっちがにレッド", color: 0xC0392B, price: 1_000_000_000 },
    { id: "emerald", name: "深海エメラルド", roleName: "🦀 深海エメラルド", color: 0x138D75, price: 1_000_000_000_000 },
    { id: "gold", name: "黄金のえっちがに", roleName: "🦀 黄金のえっちがに", color: 0xD4AC0D, price: 1_000_000_000_000_000 }
];
const purchaseLocks = new Set();

export const data = {
    name: "shop",
    description: "ettigani$で色ロールを交換します",
    options: [
        {
            name: "list",
            description: "交換できる色ロールを表示します",
            type: 1
        },
        {
            name: "buy",
            description: "色ロールを購入して付与します",
            type: 1,
            options: [
                {
                    name: "item",
                    description: "購入する色ロール",
                    type: 3,
                    required: true,
                    choices: SHOP_ITEMS.map(item => ({ name: `${item.name} (${item.price.toLocaleString("ja-JP")}$)`, value: item.id }))
                }
            ]
        }
    ]
};

function createShopEmbed() {
    return new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle("ettigani$ ショップ")
        .setDescription([
            "購入した色ロールはこのサーバーで付与されます。ettigani$の残高は全サーバー共通です。",
            "別の色を購入すると、現在のショップロールから付け替わります。"
        ].join("\n"))
        .addFields(SHOP_ITEMS.map(item => ({
            name: item.name,
            value: `**${item.price.toLocaleString("ja-JP")} ettigani$**`,
            inline: true
        })));
}

async function buyRole(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const purchaseKey = `${interaction.guildId}:${interaction.user.id}`;
    if (purchaseLocks.has(purchaseKey)) {
        await interaction.editReply("購入処理中です。少し待ってからもう一度試してください。");
        return;
    }
    purchaseLocks.add(purchaseKey);

    try {
        const guild = interaction.guild;
        const itemId = interaction.options.getString("item", true);
        const item = SHOP_ITEMS.find(candidate => candidate.id === itemId);
        if (!guild || !item) {
            await interaction.editReply("サーバー内で有効な商品を選んでください。");
            return;
        }

        const botMember = guild.members.me ?? await guild.members.fetchMe();
        if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
            await interaction.editReply("ロールを作成する権限がありません。Botに「ロールの管理」権限を付与してください。");
            return;
        }

        const balance = getBalance(guild.id, interaction.user.id);
        if (balance < item.price) {
            await interaction.editReply(`コインが足りません。必要額: **${item.price.toLocaleString("ja-JP")} ettigani$** / 残高: **${balance.toLocaleString("ja-JP")} ettigani$**`);
            return;
        }

        const member = await guild.members.fetch(interaction.user.id);
        const role = await getOrCreateShopRole(guild, item);
        if (member.roles.cache.has(role.id)) {
            await interaction.editReply(`すでに **${role.name}** を持っています。コインは消費していません。`);
            return;
        }

        if (!placeBet(guild.id, interaction.user.id, item.price)) {
            await interaction.editReply("残高が足りません。残高を確認して、もう一度試してください。");
            return;
        }

        const shopRoleIds = new Set(getGuildShopRoleIds(guild.id));
        const previousRoles = member.roles.cache.filter(existingRole => shopRoleIds.has(existingRole.id));
        const removedRoles = [];
        let newRoleAdded = false;

        try {
            await member.roles.add(role, "ettigani$ショップで色ロールを購入");
            newRoleAdded = true;
            for (const previousRole of previousRoles.values()) {
                await member.roles.remove(previousRole, "ettigani$ショップの色ロールを変更");
                removedRoles.push(previousRole);
            }
        } catch (error) {
            for (const previousRole of removedRoles) {
                await member.roles.add(previousRole).catch(() => {});
            }
            if (newRoleAdded) await member.roles.remove(role).catch(() => {});
            const refundedBalance = addCoins(guild.id, interaction.user.id, item.price);
            console.error("ショップロール付与エラー:", error);
            await interaction.editReply(`ロールの付与に失敗したため、**${item.price.toLocaleString("ja-JP")} ettigani$** を返却しました。残高: **${refundedBalance.toLocaleString("ja-JP")} ettigani$**`);
            return;
        }

        const newBalance = getBalance(guild.id, interaction.user.id);
        try {
            logCasinoEvent(interaction, "shop", {
                商品: item.name,
                支払: `${item.price} ettigani$`,
                残高: `${newBalance} ettigani$`
            });
        } catch (error) {
            console.error("ショップ購入ログの記録エラー:", error);
        }
        await interaction.editReply(`**${role.name}** を作成・付与しました！\n消費: **${item.price.toLocaleString("ja-JP")} ettigani$**\n残高: **${newBalance.toLocaleString("ja-JP")} ettigani$**`);
    } catch (error) {
        console.error("ショップ購入エラー:", error);
        await interaction.editReply("購入処理に失敗しました。Botのロール権限とロールの位置を確認してください。");
    } finally {
        purchaseLocks.delete(purchaseKey);
    }
}

export async function execute(interaction) {
    if (interaction.options.getSubcommand() === "list") {
        await interaction.reply({ embeds: [createShopEmbed()], flags: MessageFlags.Ephemeral });
        return;
    }

    await buyRole(interaction);
}