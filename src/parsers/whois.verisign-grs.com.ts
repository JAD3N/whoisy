import psl from "psl";
import ipRegex from "ip-regex";

import { register, WhoisParser } from "./registry";
import { WhoisRecord } from "../record";
import { parseDateString } from "../utils";
import { Nameserver } from "../nameserver";

function getEntries(raw: string): Record<string, string | string[]> {
	const entries: Record<string, string | string[]> = {};

	for (let line of raw.split("\n")) {
		line = line.trim();
		// finish if regards
		if (line.startsWith(">>>")) {
			break;
		}

		if (line.includes(":")) {
			const key = line.slice(0, line.indexOf(":")).trim();
			const value = line.slice(line.indexOf(":") + 1).trim();

			if (key in entries) {
				let arr = entries[key];
				if (!Array.isArray(arr)) {
					arr = [arr];
					entries[key] = arr;
				}

				arr.push(value.trim());
			} else {
				entries[key] = value.trim();
			}
		}
	}

	return entries;
}

const parse: WhoisParser = (raw: string): WhoisRecord | null => {
	const record: WhoisRecord = { raw, customFields: {} };

	if (raw.match(/^No match for/)) {
		record.status = "available";
		record.domainAvailability = true;
		return record;
	} else {
		record.status = "registered";
	}

	const entries = getEntries(raw);

	record.registrarName = entries["Registrar"] as string;
	record.registrarIANAID = entries["Registrar IANA ID"] as string;
	record.customFields!.registrarURL = entries["Registrar URL"] as string;
	record.whoisServer = entries["Registrar WHOIS Server"] as string;

	record.updatedDate =
		parseDateString(entries["Updated Date"] as string, "iso") || undefined;
	record.createdDate =
		parseDateString(entries["Creation Date"] as string, "iso") || undefined;
	record.expiresDate =
		parseDateString(entries["Registry Expiry Date"] as string, "iso") ||
		undefined;

	if (typeof entries["Domain Name"] === "string") {
		const parsed = psl.parse(entries["Domain Name"]);
		if (!parsed.error) {
			record.domainName = parsed.domain!;
			record.domainNameExt = parsed.tld!;
		}
	}

	if (entries["Name Server"]) {
		let value = entries["Name Server"];
		if (!Array.isArray(value)) {
			value = [value];
		}

		const nsArr: Nameserver[] = (record.nameservers = []);

		for (const ns of value) {
			if (ipRegex.v4({ exact: true }).test(ns)) {
				nsArr.push({ type: "ipv4", value: ns });
			} else if (ipRegex.v6({ exact: true }).test(ns)) {
				nsArr.push({ type: "ipv6", value: ns });
			} else {
				nsArr.push({ type: "hostname", value: ns });
			}
		}
	}

	record.domainAvailability = record.status === "available";
	return record;
};

register("whois.verisign-grs.com", parse);
