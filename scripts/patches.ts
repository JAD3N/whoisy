import fs from "fs/promises";
import path from "path";

async function main(): Promise<void> {
	const { default: fetch } = await import("node-fetch");
	const list = await fetch(
		"https://raw.githubusercontent.com/rfc1036/whois/next/tld_serv_list"
	).then((res) => res.text());
	const map = new Map<string, string>();

	for (let line of list.split("\n")) {
		if (line.includes("#")) {
			line = line.split("#")[0];
		}

		line = line.trim();
		if (!line.length) {
			continue;
		}

		const pieces = line.split(/\s+/);
		if (pieces.length === 2 && pieces[1] !== "NONE") {
			const tld = pieces[0].slice(1);
			if (!map.has(tld)) {
				map.set(tld, pieces[1]);
			}
		}
	}

	const servers: Record<string, string> = {};
	for (const [key, value] of map.entries()) {
		servers[key] = value;
	}

	const json = JSON.stringify(servers);
	await fs.writeFile(path.join(__dirname, "../src/patches/whois.json"), json);
}

if (require.main === module) {
	main();
}
