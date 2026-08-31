import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Discord のコマンドを保持するマップ
export const commands = new Map();
// すでに登録済み guild を避ける重複防止キャッシュ
export const guildCommandRegistrationCache = new Set();

// commands フォルダの中を再帰的に辿って、コマンドファイルを読み込む
async function loadCommandsFromDir(dirPath) {
    if (!fs.existsSync(dirPath)) return;
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            await loadCommandsFromDir(fullPath);
        } else if (entry.isFile() && entry.name.endsWith(".js")) {
            const command = await import(`file://${fullPath}`);
            if (command.data && command.data.name) {
                commands.set(command.data.name, command);
            }
        }
    }
}

// コマンドを再読込して、最新状態に揃える
export async function loadCommands() {
    commands.clear();
    const commandsPath = path.join(__dirname, "..", "commands");
    await loadCommandsFromDir(commandsPath);
    console.log(`✔ コマンド読み込み完了: ${commands.size} 個`);
    return commands;
}

// 特定 guild にコマンドを登録する
export async function registerGuildCommands(guild) {
    if (!guild || !guild.id) return;
    if (guildCommandRegistrationCache.has(guild.id)) return;

    try {
        await loadCommands();
        await guild.commands.set([...commands.values()].map(cmd => cmd.data));
        guildCommandRegistrationCache.add(guild.id);
        console.log(`✔ ${guild.name} にスラッシュコマンドを登録しました`);
    } catch (err) {
        console.error(`❌ ${guild.name} のコマンド登録中にエラー:`, err);
    }
}
