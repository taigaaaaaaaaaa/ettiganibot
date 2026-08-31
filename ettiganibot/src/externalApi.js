export async function sendLogToAPI(data) {
    try {
        await fetch("https://ettiganibot-dashboard.com/api/log.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });
    } catch (err) {
        console.error("API送信エラー:", err);
    }
}
