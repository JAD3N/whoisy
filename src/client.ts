import net from "net";
import punycode from "punycode/";
import { parse } from "./parsers";

export type Tld = string;
export type WhoisServer = string;

export class Client {
	private tldCache: Map<Tld, WhoisServer>;

	public constructor() {
		this.tldCache = new Map();
	}

	private query({
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
			socket.on("close", () => resolve(data.replace(/\r\n/g, '\n')));
			socket.on("timeout", () => socket.destroy(new Error("Timeout")));
			socket.on("error", reject);
		});
	}

	public async lookup(
		domain: string,
		{
			host,
			timeout,
			depth = 1,
		}: { host?: string; timeout?: number; depth?: number } = {}
	): Promise<any> {
		domain = punycode.toASCII(domain);
		const domainTld = domain.slice(domain.lastIndexOf(".") + 1);

		if (!host && this.tldCache.has(domainTld)) {
			host = this.tldCache.get(domainTld);
		}

		if (!host) {
			const res = await this.query({
				host: "whois.iana.org",
				query: domain,
				timeout,
			});

			const record = parse("whois.iana.org", res);
			host = record?.whoisServer;
		}

		if (!host) {
			throw new Error("No whois server found");
		}

		let result = {};

		let i = 0;
		while (host && i < depth) {
			const record = parse(host, await this.query({
				host,
				query: domain,
				timeout,
			}));

			if (record?.whoisServer) {
				host = record.whoisServer;
			} else {
				host = undefined;
			}

			if (record) {
				result = { ...result, ...record };
			}

			i++;
		}

		console.log('result', result);
	}
}
