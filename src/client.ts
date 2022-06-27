import net from "net";
import punycode from "punycode/";
import fetch from "node-fetch";

import { parse } from "./parsers";
import { WhoisRecord } from "./record";
import { parseISO } from "date-fns";
import { Nameserver } from "./nameserver";
import ipRegex from "ip-regex";

export type Tld = string;
export type WhoisServer = string;

export class Client {
	private tldCache: Map<Tld, WhoisServer>;

	public constructor() {
		this.tldCache = new Map();
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
		const res = await fetch(`https://rdap.org/domain/${domain}`);
		if (res.ok) {
			return await res.text();
		} else {
			switch (res.status) {
				case 400:
				case 404:
					// invalid domain or no service
					return null;
				case 429:
					throw new Error("Rate limit exceeded");
				default:
					throw new Error("Request failed");
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
		const domainTld = domain.slice(domain.lastIndexOf(".") + 1);

		if (rdap) {
			let rdapData = null;
			try {
				rdapData = await this.rdap(domain);
			} catch (err: unknown) {
				console.error('RDAP Error:', err);
			}

			if (rdapData) {
				const record: WhoisRecord = { raw: rdapData };
				const data = JSON.parse(rdapData);

				for (const event of data.events) {
					if (event.eventAction === 'registration') {
						record.createdDate = parseISO(event.eventDate);
					} else if (event.eventAction === 'expiration') {
						record.expiresDate = parseISO(event.eventDate);
					} else if (event.eventAction === 'last changed') {
						record.updatedDate = parseISO(event.eventDate);
					}
				}

				const nsArr: Nameserver[] = [];
				for (const nameserver of data.nameservers) {
					if (nameserver.objectClassName === 'nameserver') {
						const ns = nameserver.ldhName;
						if (ipRegex.v4({ exact: true }).test(ns)) {
							nsArr.push({ type: "ipv4", value: ns });
						} else if (ipRegex.v6({ exact: true }).test(ns)) {
							nsArr.push({ type: "ipv6", value: ns });
						} else {
							nsArr.push({ type: "hostname", value: ns });
						}
					}
				}
				if (nsArr.length) {
					record.nameservers = nsArr;
				}

				return record;
			}
		}


		if (!host && this.tldCache.has(domainTld)) {
			host = this.tldCache.get(domainTld);
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
