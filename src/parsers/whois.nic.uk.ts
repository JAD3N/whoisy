import ipRegex from "ip-regex";
import { parse as parseDate } from "date-fns";

import { register, WhoisParser } from "./registry";
import { WhoisRecord } from "../record";

const parse: WhoisParser = (raw: string): WhoisRecord | null => {
	// check if any results
	if (raw.includes("This domain name has not been registered")) {
		return null;
	}

	raw = raw.replace(/\r\n/g, "\n");

	const record: WhoisRecord = { raw, customFields: {} };
	const domainName = raw.match(/Domain name:\s+(.*)/)?.[1];
	const [, registrar, registrarUrl] =
		raw.match(/Registrar:\s+(.*)\s+URL:\s(.*)/) ?? [];

	const createdDate = raw.match(/Registered on:\s+(.+)/)?.[1];
	const expiresDate = raw.match(/Expiry date:\s+(.+)/)?.[1];
	const updatedDate = raw.match(/Last updated:\s+(.+)/)?.[1];

	record.domainName = domainName;
	record.registrarName = registrar;

	if (createdDate)
		record.createdDate = parseDate(createdDate, "dd-MMM-yyyy", new Date());
	if (expiresDate)
		record.expiresDate = parseDate(expiresDate, "dd-MMM-yyyy", new Date());
	if (updatedDate)
		record.updatedDate = parseDate(updatedDate, "dd-MMM-yyyy", new Date());

	const status = raw.match(/Registration status:\s+(.+)/)?.[1];
	const nsStr = raw.match(/Name servers:\n((.+\n)+)\n/)?.[1];

	if (nsStr) {
		const nameservers = nsStr
			.split("\n")
			.map((str) => str.trim())
			.filter((str) => !!str && !str.includes("No name servers listed"));

		if (nameservers.length) {
			record.nameservers = nameservers.map((nameserver) => {
				if (ipRegex.v4({ exact: true }).test(nameserver)) {
					return { type: "ipv4", value: nameserver };
				} else if (ipRegex.v6({ exact: true }).test(nameserver)) {
					return { type: "ipv6", value: nameserver };
				} else {
					return {
						type: "hostname",
						value: nameserver.toLowerCase(),
					};
				}
			});
		}
	}

	return record;
};

register("whois.nic.uk", parse);
