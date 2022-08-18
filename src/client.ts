import net from "net";
import punycode from "punycode/";
import fetch from "node-fetch";
import psl from "psl";
import whoisPatches from './patches/whois.json';

import { parse } from "./parsers";
import { WhoisRecord } from "./record";

export type Tld = string;
export type WhoisServer = string;
export type RdapServer = string;

export class Client {
	private whoisTldCache: Map<Tld, WhoisServer>;
	private rdapTldCache: Map<Tld, RdapServer>;

	public constructor() {
		this.whoisTldCache = new Map();
		this.rdapTldCache = new Map();

		for (const [tld, whoisServer] of Object.entries(whoisPatches)) {
			this.whoisTldCache.set(tld, whoisServer);
		}
	}

	private whois({
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
			socket.on("close", () => resolve(data.replace(/\r\n/g, "\n")));
			socket.on("timeout", () => socket.destroy(new Error("Timeout")));
			socket.on("error", reject);
		});
	}

	private async rdap(domain: string): Promise<string | null> {
		const domainTld = domain.slice(domain.lastIndexOf(".") + 1);
		if (!this.rdapTldCache.has(domainTld)) {
			return null;
		}

		const res = await fetch(
			`${this.rdapTldCache.get(domainTld)!}domain/${domain}`
		);

		if (res.ok || res.status === 404) {
			return await res.text();
		} else {
			switch (res.status) {
				case 400:
					// invalid domain or no service
					return null;
				case 429:
					throw new Error("Rate limit exceeded");
				default:
					throw new Error("Request failed");
			}
		}
	}

	public async updateRdapCache(): Promise<void> {
		const res = await fetch("https://data.iana.org/rdap/dns.json");
		const data = (await res.json()) as {
			description: string;
			publication: string;
			services: [string[], [string]][];
		};

		this.rdapTldCache.clear();

		for (const [tlds, providers] of data.services) {
			for (const provider of providers) {
				for (const tld of tlds) {
					this.rdapTldCache.set(tld, provider);
				}
			}
		}
	}

	public async lookup(
		domain: string,
		{
			host,
			timeout,
			depth = 1,
			rdap = true,
		}: {
			host?: string;
			timeout?: number;
			depth?: number;
			rdap?: boolean;
		} = {}
	): Promise<WhoisRecord | null> {
		domain = punycode.toASCII(domain);

		// extract tld
		let domainTld = domain.slice(domain.lastIndexOf(".") + 1);
		const parsed = psl.parse(domain);
		if ('tld' in parsed && parsed.tld) {
			domainTld = parsed.tld;
		}

		if (this.rdapTldCache.size === 0) {
			await this.updateRdapCache();
		}

		if (rdap && this.rdapTldCache.has(domainTld)) {
			let rdapJSON = null;
			try {
				rdapJSON = await this.rdap(domain);
			} catch (err: unknown) {
				console.error("RDAP Error:", err);
			}

			if (rdapJSON) {
				return parse("rdap", rdapJSON);
			}
		}

		if (!host && this.whoisTldCache.has(domainTld)) {
			host = this.whoisTldCache.get(domainTld);
		}

		if (!host) {
			const res = await this.whois({
				host: "whois.iana.org",
				query: domain,
				timeout,
			});

			const record = parse("whois.iana.org", res);
			if (!record) {
				throw new Error(`No record found for ${domain}`);
			} else if (!record?.whoisServer) {
				throw new Error(`TLD for "${domain}" not supported`);
			}

			host = record.whoisServer;
		}

		if (!host) {
			throw new Error("No whois server found");
		}

		let result: WhoisRecord | null = null;
		let i = 0;

		while (host && i < depth) {
			const record = parse(
				host,
				await this.whois({
					host,
					query: domain,
					timeout,
				})
			);

			if (record?.whoisServer) {
				host = record.whoisServer;
			} else {
				host = undefined;
			}

			if (record) {
				result = { ...(result ?? {}), ...record };
			}

			i++;
		}

		return result;
	}
}
