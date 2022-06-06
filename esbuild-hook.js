const Module = require("module");
const { transformSync } = require("esbuild");
const sourceMapSupport = require("source-map-support");

const cache = {};

function run(code, path) {
	const result = transformSync(code, {
		target: "node16",
		sourcemap: "both",
		loader: "ts",
		format: "cjs",
		sourcefile: path,
	});

	cache[path] = result;
	return result.code;
}

sourceMapSupport.install({
	environment: "node",
	retrieveFile: path => {
		const file = cache[path];
		if (file) {
			return file.code;
		} else {
			return "";
		}
	},
});


const defaultLoader = Module._extensions[".js"];

Module._extensions[".ts"] = function (mod, filename) {
	if (filename.includes("node_modules")) {
		return defaultLoader(mod, filename);
	}

	const defaultCompile = mod._compile;
		mod._compile = function (code) {
		mod._compile = defaultCompile;
		return mod._compile(run(code, filename), filename);
	};

	defaultLoader(mod, filename);
};
