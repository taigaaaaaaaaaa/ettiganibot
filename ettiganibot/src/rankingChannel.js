export async function getRankingChannel(client, guild, settings) {
    const channelId = settings[guild.id]?.rank_channel;
    if (channelId) {
        const channel = await client.channels.fetch(channelId).catch(() => null);
        return channel?.isTextBased() && channel.guild?.id === guild.id
            ? channel
            : null;
    }

    const botMember = guild.members.me;
    return botMember
        ? guild.channels.cache.find(channel =>
            channel.isTextBased() &&
            channel.permissionsFor(botMember)?.has("SendMessages")
        ) ?? null
        : null;
}
