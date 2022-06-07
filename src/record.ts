import { Contact } from "./contact";
import { Nameserver } from "./nameserver";

export interface WhoisRecord {
	createdDate?: Date;
	updatedDate?: Date;
	expiresDate?: Date;
	registrant?: Contact;
	admin?: Contact;
	billing?: Contact;
	tech?: Contact;
	zone?: Contact;
	domainName?: string;
	domainNameExt?: string;
	domainAvailability?: boolean;
	nameservers?: Nameserver[];
	status?: string;
	registrarName?: string;
	registrarIANAID?: string;
	whoisServer?: string;
	customFields?: Record<string, string | string[]>;
	raw: string;
}
