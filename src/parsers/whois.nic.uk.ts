import psl from "psl";
import ipRegex from "ip-regex";

import { register, WhoisParser } from "./registry";
import { WhoisRecord } from "../record";
import { getGroup, parseDateString } from "../utils";
import { Nameserver } from "../nameserver";

const parse: WhoisParser = (raw: string): WhoisRecord | null => {
	const record: WhoisRecord = { raw, customFields: {} };

	// check if any results
	if (
		raw.match(/The WHOIS query quota for .+ has been exceeded/) ||
		raw.includes("This domain cannot be registered")
	) {
		return null;
	}

	if (raw.match(/The WHOIS query quota for .+ has been exceeded/)) {
		throw new Error("Query quota exceeded!");
	}

	record.createdDate =
		parseDateString(
			getGroup(raw, /\s+Registered on:\s+(.+)\n/),
			"dd-MMM-yyyy"
		) || undefined;
	record.updatedDate =
		parseDateString(
			getGroup(raw, /\s+Last updated:\s+(.+)\n/),
			"dd-MMM-yyyy"
		) || undefined;
	record.expiresDate =
		parseDateString(
			getGroup(raw, /\s+Expiry date:\s+(.+)\n/),
			"dd-MMM-yyyy"
		) || undefined;

	const status = getGroup(raw, /\s+Registration status:\s+(.+?)\n/);
	if (status) {
		switch (status.toLowerCase()) {
			case "registered until expiry date.":
			case "registration request being processed.":
			case "renewal request being processed.":
			case "no longer required":
			case "renewawl required.":
				record.status = "registered";
				break;
			case "no registration status listed.":
				record.status = "reserved";
				break;
		}
	} else {
		record.status = "available";
	}

	const nameservers = getGroup(raw, /Name servers:\n((.+\n)+)\n/);
	if (nameservers) {
		const nsArr: Nameserver[] = (record.nameservers = []);
		nameservers
			.split("\n")
			.filter(
				(line) => line.trim() && !line.match(/No name servers listed/)
			)
			.map((line) => {
				const parts = line.trim().split(/\s+/);
				for (const part of parts) {
					if (ipRegex.v4({ exact: true }).test(part)) {
						nsArr.push({ type: "ipv4", value: part });
					} else if (ipRegex.v6({ exact: true }).test(part)) {
						nsArr.push({ type: "ipv6", value: part });
					} else {
						nsArr.push({ type: "hostname", value: part });
					}
				}
			});
	}

	const registrar = raw.match(/Registrar:\n((.+\n)+)\n/);
	if (registrar) {
		const content = (registrar[1] || "").trim();
		if (content.match(/Tag =/)) {
			const parts = content.match(/(.+) \[Tag = (.+)\]/);
			record.registrarName = parts?.[1].trim?.();

			const url = content.match(/URL: (.+)/);
			if (url) {
				record.customFields!.registrarURL = url?.[1]?.trim();
			}
		} else if (
			content.match(/This domain is registered directly with Nominet/)
		) {
			record.registrarName = "Nominet";
			record.customFields!.registrarOrganization = "Nominet UK";
			record.customFields!.registrarURL = "http://www.nic.uk/";
		}
	}

	const domain = getGroup(raw, /\s+Domain name:\s+(.+?)\n/);
	if (domain) {
		const parsed = psl.parse(domain);
		if (!parsed.error) {
			record.domainName = parsed.domain!;
			record.domainNameExt = parsed.tld!;
		}
	}

	record.domainAvailability = record.status === "available";
	return record;
};

register("whois.nic.uk", parse);
