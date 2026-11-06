export default function MarkdownContent({ source }) {
  const lines = source.split(/\r?\n/);
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const codeStart = line.match(/^```(\w*)\s*$/);
    if (codeStart) {
      const codeLines = [];
      index += 1;
      while (index < lines.length && !/^```\s*$/.test(lines[index])) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push(
        <pre className="markdown-code" key={`code-${index}`}>
          <code>{codeLines.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const Heading = `h${heading[1].length}`;
      blocks.push(<Heading key={`heading-${index}`}>{heading[2]}</Heading>);
      index += 1;
      continue;
    }

    if (/^\s*[-*+]\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^\s*[-*+]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*[-*+]\s+/, ""));
        index += 1;
      }
      blocks.push(
        <ul key={`list-${index}`}>
          {items.map((item, itemIndex) => (
            <li key={`${index}-${itemIndex}`}>{item}</li>
          ))}
        </ul>,
      );
      continue;
    }

    const paragraph = [line];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^#{1,6}\s+/.test(lines[index]) &&
      !/^```/.test(lines[index]) &&
      !/^\s*[-*+]\s+/.test(lines[index])
    ) {
      paragraph.push(lines[index]);
      index += 1;
    }
    blocks.push(<p key={`paragraph-${index}`}>{paragraph.join("\n")}</p>);
  }

  return <div className="markdown-content">{blocks}</div>;
}
