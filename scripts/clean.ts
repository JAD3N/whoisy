import fs from "fs/promises";
import path from "path";

async function rmrf(pathFromRoot: string): Promise<void> {
	await fs.rm(path.join(__dirname, "../", pathFromRoot), {
		recursive: true,
		force: true,
	});
}

async function main(): Promise<void> {
	await rmrf("build");
}

if (require.main === module) {
	main();
}
