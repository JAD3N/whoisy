import net from "net";

async function getAllTlds(): Promise<string[]> {
	const { default: fetch } = await import('node-fetch');
	const res = await fetch(
		"https://data.iana.org/TLD/tlds-alpha-by-domain.txt"
	).then((res) => res.text());

	return res
		.split("\n")
		.filter((line) => !!line && !line.startsWith("#"))
		.map((line) => line.trim().toLowerCase());
}

function query({
	host,
	port = 43,
	timeout = 15_000,
	query = "",
	querySuffix = "\r\n",
}: {
	host?: string;
	port?: number;
	timeout?: number;
	query?: string;
	querySuffix?: string;
}): Promise<string> {
	return new Promise((resolve, reject) => {
		let data = "";
		const fullQuery = query + querySuffix;

		const socket = net.connect({ host, port }, () => {
			// on connect
			socket.write(fullQuery);
		});

		socket.setTimeout(timeout);
		socket.on("data", (chunk) => (data += chunk));
		socket.on("close", () => resolve(data));
		socket.on("timeout", () => socket.destroy(new Error("Timeout")));
		socket.on("error", reject);
	});
}

(async function () {
	const res = await query({
		host: "whois.iana.org",
		query: "dfhdkhfldfsdhl.rs",
	});

	console.log("res", res);
})();


/*

Notes:
* keys can have spaces in them
* keys can have a suffix, prefix or both: [Key]  or  Key:
* values can be multiline (some lines have indentation some end when empty new line is after)
* comments can be % or *
* end of whois can be >>>
* lines with values should be ignored
* keys can have a padding suffix (of variable length):  test*****: test
*/