import { parseISO } from "date-fns";
import ipRegex from "ip-regex";
import psl from "psl";
import { Contact } from "../contact";

import { Nameserver } from "../nameserver";
import { WhoisRecord } from "../record";
import { register } from "./registry";

export function parse(raw: string): WhoisRecord | null {
	let data;
	try {
		data = JSON.parse(raw);
	} catch {
		return null;
	}

	const record: WhoisRecord = { raw, customFields: {} };

	if (data.errorCode === 404) {
		record.status = "available";
		record.domainAvailability = true;
		return record;
	} else {
		record.status = "registered";
	}

	for (const event of data.events) {
		if (event.eventAction === "registration") {
			record.createdDate = parseISO(event.eventDate);
		} else if (event.eventAction === "expiration") {
			record.expiresDate = parseISO(event.eventDate);
		} else if (event.eventAction === "last changed") {
			record.updatedDate = parseISO(event.eventDate);
		}
	}

	const nsArr: Nameserver[] = [];
	for (const nameserver of data.nameservers) {
		if (nameserver.objectClassName === "nameserver") {
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

	for (const entity of data.entities) {
		if (entity.roles.includes("registrar")) {
			// extract iana id
			for (const publicId of entity.publicIds) {
				if (publicId.type === "IANA Registrar ID") {
					record.registrarIANAID = publicId.identifier;
					break;
				}
			}

			if (entity.vcardArray[0] === "vcard") {
				const vcardArray = entity.vcardArray[1];
				for (const entry of vcardArray) {
					if (entry[0] === "fn" && entry[2] === "text") {
						record.registrarName = entry[3];
						break;
					}
				}
			}
		} else if (entity.roles.includes("registrant") || entity.roles.includes("technical") || entity.roles.includes("administrative")) {
			const contact: Contact = {};

			if (entity.vcardArray[0] === "vcard") {
				const vcardArray = entity.vcardArray[1];
				for (const entry of vcardArray) {
					if (entry[0] === "org" && entry[2] === "text") {
						contact.organization = entry[3];
					} else if (entry[0] === "fn" && entry[2] === "text") {
						contact.name = entry[3];
					} else if (entry[0] === "adr" && entry[2] === "text") {
						const [
							,
							street2,
							street1,
							city,
							state,
							postalCode,
							countryCode,
						] = entry[3];

						contact.street1 = street1;
						contact.street2 = street2;
						contact.city = city;
						contact.state = state;
						contact.postalCode = postalCode;
						contact.countryCode = countryCode;
					}
				}
			}

			if (Object.keys(contact).length > 0) {
				if (entity.roles.includes("registrant")) {
					record.registrant = contact;
				} else if (entity.roles.includes("administrative")) {
					record.admin = contact;
				} else if (entity.roles.includes("technical")) {
					record.tech = contact;
				}
			}
		}
	}

	const parsedDomain = psl.parse(data.ldhName);
	if (!parsedDomain.error) {
		record.domainName = parsedDomain.domain || undefined;
		record.domainNameExt = parsedDomain.tld || undefined;
	}

	record.domainAvailability = record.status === 'available';
	return record;
}

register("rdap", parse);
