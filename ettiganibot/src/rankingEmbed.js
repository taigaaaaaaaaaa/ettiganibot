import { EmbedBuilder } from "discord.js";

const DASHBOARD_URL = "https://ettiganibot-dashboard.com/";
const MAX_COMMUNITY_DESCRIPTION_LENGTH = 3500;

export function createRankingEmbed(title, rankingLines) {
    return new EmbedBuilder()
        .setColor(0x7289DA)
        .setTitle(title)
        .setDescription([
            ...rankingLines,
            "",
            "週間・月間・累計のランキングは、こちらのサイトで確認できます！",
            DASHBOARD_URL,
        ].join("\n"));
}

export function createCommunityPostEmbeds(posts) {
    const entries = posts.length
        ? posts.map(post => {
            const name = (post.author?.globalName || post.author?.username || "名前不明")
                .replace(/([\\*_~`|>])/g, "\\$1");
            const url = `${DASHBOARD_URL}community/${encodeURIComponent(post.id)}`;
            const likes = Array.isArray(post.likes) ? post.likes.length : 0;
            const comments = Array.isArray(post.comments) ? post.comments.length : 0;
            const saves = Array.isArray(post.saves) ? post.saves.length : 0;
            return `**${name}**\n${url}\nいいね: ${likes} | コメント: ${comments} | 保存: ${saves}`;
        })
        : ["今日は投稿がありませんでした。"];

    const descriptions = [];
    let description = "";
    for (const entry of entries) {
        const nextDescription = description ? `${description}\n\n${entry}` : entry;
        if (description && nextDescription.length > MAX_COMMUNITY_DESCRIPTION_LENGTH) {
            descriptions.push(description);
            description = entry;
        } else {
            description = nextDescription;
        }
    }
    if (description) descriptions.push(description);

    return descriptions.map((value, index) =>
        new EmbedBuilder()
            .setColor(0x7289DA)
            .setTitle(index === 0 ? "今日のコミュニティ投稿" : "今日のコミュニティ投稿（続き）")
            .setDescription(value)
    );
}