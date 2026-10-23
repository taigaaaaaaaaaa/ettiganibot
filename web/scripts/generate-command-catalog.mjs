import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "acorn";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const commandsDirectory = path.resolve(
  process.env.BOT_COMMANDS_DIR || path.resolve(scriptDirectory, "../../ettiganibot/commands"),
);
const outputPath = path.resolve(scriptDirectory, "../app/data/commands.json");

async function findCommandFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return findCommandFiles(entryPath);
      return entry.isFile() && entry.name.endsWith(".js") ? [entryPath] : [];
    }),
  );
  return nested.flat();
}

function getProperty(object, name) {
  if (!object || object.type !== "ObjectExpression") return null;
  return object.properties.find((property) => {
    const key = property.key?.name ?? property.key?.value;
    return key === name;
  })?.value;
}

function getString(node) {
  return node?.type === "Literal" && typeof node.value === "string" ? node.value : null;
}

function readOptions(node) {
  if (node?.type !== "ArrayExpression") return [];

  return node.elements
    .filter((option) => option?.type === "ObjectExpression")
    .map((option) => ({
      name: getString(getProperty(option, "name")),
      description: getString(getProperty(option, "description")),
      options: readOptions(getProperty(option, "options")),
    }))
    .filter((option) => option.name);
}

let files;
try {
  files = (await findCommandFiles(commandsDirectory)).sort((left, right) =>
    left.localeCompare(right),
  );
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  await fs.access(outputPath);
  console.warn(`Bot command source unavailable; keeping the packaged catalog at ${outputPath}`);
  process.exit(0);
}
const commands = [];

for (const filePath of files) {
  const source = await fs.readFile(filePath, "utf8");
  const syntax = parse(source, { ecmaVersion: "latest", sourceType: "module" });
  const declaration = syntax.body
    .filter((statement) => statement.type === "ExportNamedDeclaration")
    .flatMap((statement) => statement.declaration?.declarations || [])
    .find((item) => item.id?.name === "data");
  const data = declaration?.init;
  const name = getString(getProperty(data, "name"));
  const description = getString(getProperty(data, "description"));

  if (name && description) {
    commands.push({
      name,
      description,
      options: readOptions(getProperty(data, "options")),
    });
  }
}

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(commands, null, 2)}\n`, "utf8");
console.log(`Generated ${commands.length} commands from ${commandsDirectory}`);
