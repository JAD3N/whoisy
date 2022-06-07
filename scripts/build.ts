import path from "path";
import esbuild from "esbuild";

function getConfig(format: "cjs" | "esm"): esbuild.BuildOptions {
	return {
		platform: "node",
		target: "esnext",
		format,
		nodePaths: [path.join(__dirname, "../src")],
		sourcemap: true,
		external: [],
		outdir: path.join(__dirname, `../build/${format}`),
		entryPoints: [path.join(__dirname, "../src/index.ts")],
		bundle: true,
	};
}

async function main(): Promise<void> {
	await esbuild.build(getConfig("cjs"));
	await esbuild.build(getConfig("esm"));
}

if (require.main === module) {
	main();
}
