import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function getCommunityDataDirectory() {
    return process.env.COMMUNITY_DATA_DIR ||
        path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "community-data");
}

function getTokyoDate(date) {
    const parts = new Intl.DateTimeFormat("en", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    return `${values.year}-${values.month}-${values.day}`;
}

export function getTodaysCommunityPosts(now = new Date()) {
    let store;
    try {
        store = JSON.parse(
            fs.readFileSync(path.join(getCommunityDataDirectory(), "community.json"), "utf8")
        );
    } catch (error) {
        if (error.code === "ENOENT") return [];
        throw new Error(`コミュニティデータを読み込めません: ${error.message}`);
    }

    if (!Array.isArray(store?.posts)) {
        throw new Error("コミュニティデータの投稿一覧が不正です。");
    }

    const today = getTokyoDate(now);
    return store.posts
        .filter(post => {
            if (post?.visibility !== "public" || typeof post.createdAt !== "string") return false;
            const createdAt = new Date(post.createdAt);
            return !Number.isNaN(createdAt.getTime()) && getTokyoDate(createdAt) === today;
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}
