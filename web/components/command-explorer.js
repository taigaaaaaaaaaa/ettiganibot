"use client";

import { useState } from "react";
import { Search } from "lucide-react";

const categories = [
  {
    label: "集計・レベル",
    commands: new Set([
      "today",
      "weekly",
      "monthly",
      "total",
      "my_today",
      "my_weekly",
      "my_monthly",
      "my_total",
      "level",
      "level_rank",
      "next_level",
    ]),
  },
  {
    label: "通貨・ゲーム",
    commands: new Set([
      "balance",
      "daily",
      "shop",
      "slot",
      "highlow",
      "blackjack",
      "ura_slot",
      "ura_dice",
    ]),
  },
  {
    label: "サーバー・その他",
    commands: new Set(["gamertag", "deletedmessage", "setting", "ping", "help"]),
  },
  { label: "ボイス", commands: new Set(["ettigani_join", "ettigani_leave", "tts-set"]) },
];

function flattenOptions(options, prefix = "") {
  return options.flatMap((option) => {
    const name = prefix ? `${prefix} ${option.name}` : option.name;
    return [
      { name, description: option.description },
      ...flattenOptions(option.options || [], name),
    ];
  });
}

export default function CommandExplorer({ commands }) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase("ja-JP");
  const visibleCommands = commands.filter((command) => {
    const searchable = `${command.name} ${command.description} ${JSON.stringify(command.options)}`;
    return searchable.toLocaleLowerCase("ja-JP").includes(normalizedQuery);
  });

  return (
    <>
      <label className="command-search">
        <Search aria-hidden="true" size={18} />
        <input
          onChange={(event) => setQuery(event.target.value)}
          placeholder="コマンドを検索"
          value={query}
        />
      </label>
      {categories.map((category) => {
        const group = visibleCommands.filter((command) => category.commands.has(command.name));
        if (!group.length) return null;
        return (
          <section className="command-group" key={category.label}>
            <h2 className="section-title">{category.label}</h2>
            <div className="command-list">
              {group.map((command) => {
                const options = flattenOptions(command.options || []);
                return (
                  <article className="command-row" key={command.name}>
                    <div className="command-name">/{command.name}</div>
                    <div className="command-description">{command.description}</div>
                    {options.length ? (
                      <div className="command-options">
                        {options.map((option) => (
                          <div key={`${command.name}:${option.name}`}>
                            <code>
                              /{command.name} {option.name}
                            </code>
                            {option.description ? ` - ${option.description}` : ""}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
      {!visibleCommands.length ? (
        <p className="empty-state">一致するコマンドはありません。</p>
      ) : null}
    </>
  );
}
