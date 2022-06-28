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

	if (raw.match(/^Domain not found/)) {
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

	record.registrant = {
		name: entries["Registrant Name"] as string,
		organization: entries["Registrant Organization"] as string,
		street1: entries["Registrant Street"] as string,
		city: entries["Registrant City"] as string,
		state: entries["Registrant State/Province"] as string,
		postalCode: entries["Registrant Postal Code"] as string,
		countryCode: entries["Registrant Country"] as string,
		email: entries["Registrant Email"] as string,
		telephone: entries["Registrant Phone"] as string,
		telephoneExt: entries["Registrant Phone Ext"] as string,
		fax: entries["Registrant Fax"] as string,
		faxExt: entries["Registrant Fax Ext"] as string,
	};

	record.admin = {
		name: entries["Admin Name"] as string,
		organization: entries["Admin Organization"] as string,
		street1: entries["Admin Street"] as string,
		city: entries["Admin City"] as string,
		state: entries["Admin State/Province"] as string,
		postalCode: entries["Admin Postal Code"] as string,
		countryCode: entries["Admin Country"] as string,
		email: entries["Admin Email"] as string,
		telephone: entries["Admin Phone"] as string,
		telephoneExt: entries["Admin Phone Ext"] as string,
		fax: entries["Admin Fax"] as string,
		faxExt: entries["Admin Fax Ext"] as string,
	};

	record.admin = {
		name: entries["Tech Name"] as string,
		organization: entries["Tech Organization"] as string,
		street1: entries["Tech Street"] as string,
		city: entries["Tech City"] as string,
		state: entries["Tech State/Province"] as string,
		postalCode: entries["Tech Postal Code"] as string,
		countryCode: entries["Tech Country"] as string,
		email: entries["Tech Email"] as string,
		telephone: entries["Tech Phone"] as string,
		telephoneExt: entries["Tech Phone Ext"] as string,
		fax: entries["Tech Fax"] as string,
		faxExt: entries["Tech Fax Ext"] as string,
	};

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

register("whois.publicinterestregistry.org", parse);
