import { readJson, writeJson } from "./dataPaths.js";

const ROLE_SHOP_FILE = "roleShop.json";
const roleCreationPromises = new Map();

function loadRoleShopData() {
    const data = readJson(ROLE_SHOP_FILE, {});
    return data && typeof data === "object" && !Array.isArray(data) ? data : {};
}

export function getGuildShopRoleIds(guildId) {
    const roles = loadRoleShopData()[guildId];
    return roles && typeof roles === "object" ? Object.values(roles) : [];
}

export async function getOrCreateShopRole(guild, item) {
    const lockKey = `${guild.id}:${item.id}`;
    if (roleCreationPromises.has(lockKey)) return roleCreationPromises.get(lockKey);

    const creation = (async () => {
        const data = loadRoleShopData();
        const roleId = data[guild.id]?.[item.id];
        if (roleId) {
            const cachedRole = guild.roles.cache.get(roleId);
            if (cachedRole) return cachedRole;

            const fetchedRole = await guild.roles.fetch(roleId).catch(error => {
                if (error.code === 10011) return null;
                throw error;
            });
            if (fetchedRole) return fetchedRole;
        }

        const role = await guild.roles.create({
            name: item.roleName,
            colors: { primaryColor: item.color },
            reason: "ettigani$ショップで購入された色ロール"
        });

        const latestData = loadRoleShopData();
        if (!latestData[guild.id] || typeof latestData[guild.id] !== "object") {
            latestData[guild.id] = {};
        }
        latestData[guild.id][item.id] = role.id;
        writeJson(ROLE_SHOP_FILE, latestData);
        return role;
    })();

    roleCreationPromises.set(lockKey, creation);
    try {
        return await creation;
    } finally {
        roleCreationPromises.delete(lockKey);
    }
}