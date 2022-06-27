import { parse as parseDate } from "date-fns";

export function getGroup(str: string, re: RegExp, group = 1): string | null {
	return str.match(re)?.[group] ?? null;
}

export function parseDateString(str: string | null | undefined, format: string): Date | null | undefined {
	if (str !== null && str !== undefined) {
		return parseDate(str, format, new Date());
	} else {
		return str;
	}
}