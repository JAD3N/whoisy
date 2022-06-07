import { WhoisRecord } from "../record";

export type WhoisParser = (raw: string) => WhoisRecord | null;

const map: Map<string, WhoisParser> = new Map();

export function register(whoisServer: string, parser: WhoisParser): void {
	map.set(whoisServer, parser);
}

export function parse(whoisServer: string, raw: string): WhoisRecord | null {
	const parser = map.get(whoisServer);
	if (parser) {
		return parser(raw);
	} else {
		return null;
	}
}
