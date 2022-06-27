import { parse as parseDate } from "date-fns";
import ipRegex from "ip-regex";

import { register, WhoisParser } from "./registry";
import { Contact } from "../contact";
import { WhoisRecord } from "../record";

function getGroups(raw: string): Record<string, string | string[]>[] {
	const groups: Record<string, string | string[]>[] = [{}];
	let previousLabel = null;

	for (const line of raw.split("\n")) {
		if (line.startsWith("%")) {
			previousLabel = null;
			continue;
		}

		const group = groups[groups.length - 1];

		if (line) {
			if (line.includes(":")) {
				const index = line.indexOf(":");
				const label = line.slice(0, index).trim();
				const value = line.slice(index + 1).trim();

				previousLabel = label;

				if (group && group[label]) {
					const entry = group[label];
					if (Array.isArray(entry)) {
						entry.push(value);
					} else {
						group[label] = [entry, value];
					}
				} else {
					group[label] = value;
				}
			} else if (previousLabel) {
				group[previousLabel] += "\n" + line.trim();
			}
		} else if (Object.keys(group).length) {
			// only add new group if there is something in it
			previousLabel = null;
			groups.push({});
		}
	}

	if (!Object.keys(groups[groups.length - 1]).length) {
		groups.pop();
	}

	return groups;
}

const contactFields: Record<string, keyof Contact> = {
	name: "name",
	organisation: "organization",
	organization: "organization",
	phone: "telephone",
	"fax-no": "fax",
	"e-mail": "email",
};

const dateFields: Record<string, keyof WhoisRecord> = {
	created: "createdDate",
	changed: "updatedDate",
};

const extraFields: Record<string, keyof WhoisRecord> = {
	whois: "whoisServer",
	domain: "domainNameExt",
	status: "status",
};

const parse: WhoisParser = (raw: string): WhoisRecord | null => {
	// check if any results
	if (raw.includes("returned 0 objects") || raw.includes("No match found")) {
		return null;
	}

	const record: WhoisRecord = { raw, customFields: {} };
	const groups = getGroups(raw);

	for (const group of groups) {
		if (group.contact || group.organization || group.organisation) {
			const contact: Contact = {};

			for (const [key, value] of Object.entries(group)) {
				if (contactFields[key] && typeof value === "string") {
					const newKey = contactFields[key];
					contact[newKey] = value;
				} else if (key === "address") {
					// TODO: parse address
				}
			}

			if (group.contact === "administrative") {
				record.admin = contact;
			} else if (group.contact === "technical") {
				record.tech = contact;
			} else if (
				!group.contact &&
				(group.organization || group.organisation)
			) {
				record.registrant = contact;
			}
		} else {
			for (const [key, value] of Object.entries(group)) {
				if (dateFields[key] && typeof value === "string") {
					const date = parseDate(value, "yyyy-MM-dd", new Date());
					const newKey = dateFields[key];
					Reflect.set(record, newKey, date);
				} else if (extraFields[key] && typeof value === "string") {
					const newKey = extraFields[key];
					Reflect.set(record, newKey, value);
				} else if (key === "nserver") {
					const nameservers = Array.isArray(value)
						? value.join(" ")
						: value;
					const parts = nameservers
						.split(" ")
						.map((part) => part.trim())
						.filter((part) => !!part);

					if (!record.nameservers) {
						record.nameservers = [];
					}

					const nsArr = record.nameservers;
					for (const part of parts) {
						if (ipRegex.v4({ exact: true }).test(part)) {
							nsArr.push({ type: "ipv4", value: part });
						} else if (ipRegex.v6({ exact: true }).test(part)) {
							nsArr.push({ type: "ipv6", value: part });
						} else {
							nsArr.push({
								type: "hostname",
								value: part.toLowerCase(),
							});
						}
					}
				} else if (record.customFields) {
					// record.customFields[key] = value;
					if (key in record.customFields) {
						const valueArr = Array.isArray(value) ? value : [value];
						let entry = record.customFields[key];
						if (!Array.isArray(entry)) {
							entry = record.customFields[key] = [
								entry,
								...valueArr,
							];
						}
						entry.push(...valueArr);
					} else {
						record.customFields[key] = value;
					}
				}
			}
		}
	}

	return record;
};

register("whois.iana.org", parse);
