export * from "./client";
export * from "./contact";
export * from "./nameserver";
export * from "./record";

export async function getAllTlds(): Promise<string[]> {
	const { default: fetch } = await import("node-fetch");
	const res = await fetch(
		"https://data.iana.org/TLD/tlds-alpha-by-domain.txt"
	).then((res) => res.text());

	return res
		.split("\n")
		.filter((line) => !!line && !line.startsWith("#"))
		.map((line) => line.trim().toLowerCase());
}
