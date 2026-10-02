export const data = {
    name: "ping",
    description: "botの応答速度を確認します"
};

export async function execute(interaction) {
    await interaction.reply({ content: "計測中..." });

    const message = await interaction.fetchReply();
    const responseTime = message.createdTimestamp - interaction.createdTimestamp;
    const websocketPing = interaction.client.ws.ping;

    await interaction.editReply(
        `🏓 Pong!\n応答速度: **${responseTime}ms**\nWebSocket遅延: **${websocketPing}ms**`
    );
}