export interface Nameserver {
	type: 'hostname' | 'ipv4' | 'ipv6';
	value: string;
}
