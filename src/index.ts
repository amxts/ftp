/**
 * FTP, FTPS and SFTP for amxts plugins: a client that logs in once, then
 * uploads, downloads and lists files - every call a request of the server's
 * network client, settled on a later frame, so the game never waits. A
 * library: the build compiles it into each plugin that imports it. How to
 * use it: README.md.
 */
import { URL } from "@amxts/core";
import { request, RequestOptions, RequestResult } from "@amxts/core/kit";

/** How `ftp.connect` logs in, and what every call of the client takes by default. */
export interface FtpOptions {
	/** The user to log in as; the address's own (`sftp://admin@example.com`) when left out. */
	user?: string;
	/** The password to log in with; the address's own when left out. */
	password?: string;
	/**
	 * SFTP: the private key to log in with, a file of the game folder
	 * (`addons/amxmodx/data/backup_key`) - an RSA key in PEM.
	 */
	keyFile?: string;
	/** SFTP: the passphrase `keyFile` is encrypted with. */
	keyPassphrase?: string;
	/**
	 * SFTP: the server's host key, its SHA-256 fingerprint in base64 as
	 * `ssh-keygen -lf` prints it, without `SHA256:`. A server with another key
	 * is refused; left out, any host key is taken.
	 */
	hostKey?: string;
	/**
	 * FTPS: the certificate authorities the server's certificate must come
	 * from, as PEM text - for a server with a certificate of its own making.
	 * Left out, the ones a browser trusts.
	 */
	ca?: string;
	/** Milliseconds each call may take before it fails; no limit by default. */
	timeout?: number;
}

/** One call's own options: `upload`'s, `download`'s and the others' last argument. */
export interface FtpCallOptions {
	/** Milliseconds this call may take before it fails; the client's `timeout` when left out. */
	timeout?: number;
	/** A signal that cancels the call; the promise then rejects with the signal's reason. */
	signal?: AbortSignal | null;
}

/** A file or a folder in a listing. */
export interface FtpEntry {
	/** The entry's name, without its folder, e.g. `"maps.ini"`. */
	name: string;
	/** The entry's size in bytes; a folder's as the server gives it. */
	size: number;
	/** `true` for a folder. */
	isDirectory: boolean;
	/** The entry's last change, as the server lists it: to the minute, or to the day for an older file. */
	modified: Date;
}

/** Where a client's addresses start: the protocol, the host and the folder of `ftp.connect`'s address. */
interface Origin {
	/** `"ftp:"`, `"ftpes:"`, `"ftps:"` or `"sftp:"`, as the address has it. */
	scheme: string;
	/** The host and its port, e.g. `"example.com:2121"`. */
	host: string;
	/** The address's folder, encoded, without a slash at the end: `""` or `"/backup"`. */
	folder: string;
}

/**
 * A connection to an FTP, FTPS or SFTP server, from `ftp.connect`. Every call
 * returns a promise and runs on the server's network client.
 *
 * ```ts
 * await client.upload("addons/amxmodx/logs/today.log", "/backup/today.log");
 * const entries = await client.list("/backup");
 * await client.close();
 * ```
 */
export class FtpClient {
	private closed = false;

	constructor(private readonly origin: Origin, private readonly user: string, private readonly login: FtpOptions) {}

	/**
	 * Sends a file of the game folder to `remotePath`, byte for byte - a log, a
	 * map, a demo - making the remote folders that are not there.
	 *
	 * ```ts
	 * await client.upload("addons/amxmodx/logs/today.log", "/backup/today.log");
	 * ```
	 */
	async upload(localPath: string, remotePath: string, options: FtpCallOptions = {}) {
		const transfer = this.requestOptions(options);
		transfer.upload = true;
		transfer.createDirs = true;
		transfer.file = localPath;
		await this.send("upload", remotePath, this.address(remotePath, false), transfer);
	}

	/**
	 * Fetches `remotePath` into a file of the game folder, byte for byte. A
	 * download that fails leaves a file already there as it was.
	 *
	 * ```ts
	 * await client.download("/maps/de_dust2.bsp", "maps/de_dust2.bsp");
	 * ```
	 */
	async download(remotePath: string, localPath: string, options: FtpCallOptions = {}) {
		const transfer = this.requestOptions(options);
		transfer.file = localPath;
		await this.send("download", remotePath, this.address(remotePath, false), transfer);
	}

	/**
	 * The text of `remotePath`, read as UTF-8 - a config, a list.
	 *
	 * ```ts
	 * const maps = await client.readFile("/configs/maps.ini");
	 * ```
	 */
	async readFile(remotePath: string, options: FtpCallOptions = {}) {
		const result = await this.send("readFile", remotePath, this.address(remotePath, false), this.requestOptions(options));
		return result.text();
	}

	/**
	 * Writes `text` to `remotePath` as UTF-8, in place of what was there,
	 * making the remote folders that are not there.
	 *
	 * ```ts
	 * await client.writeFile("/status/online.txt", `${server.players.length}`);
	 * ```
	 */
	async writeFile(remotePath: string, text: string, options: FtpCallOptions = {}) {
		const transfer = this.requestOptions(options);
		transfer.upload = true;
		transfer.createDirs = true;
		transfer.body = text;
		await this.send("writeFile", remotePath, this.address(remotePath, false), transfer);
	}

	/**
	 * The files and folders in `remotePath` - the folder of `ftp.connect`'s
	 * address when left out.
	 *
	 * ```ts
	 * const entries = await client.list("/configs");
	 * const big = entries.filter((entry) => !entry.isDirectory && entry.size > 1_000_000);
	 * ```
	 */
	async list(remotePath?: string, options: FtpCallOptions = {}) {
		const path = remotePath ?? "";
		const result = await this.send("list", path, this.address(path, true), this.requestOptions(options));
		return parseListing(result.text());
	}

	/** Ends the client: a call after it rejects. */
	async close() {
		this.closed = true;
	}

	/** @hidden checks the login: the folder of the address entered, nothing transferred. */
	async __check() {
		const check = this.requestOptions({});
		check.method = "HEAD";
		await this.send("connect", "", this.address("", true), check);
	}

	/** The request's options: the login, then the call's timeout and signal. */
	private requestOptions(options: FtpCallOptions) {
		const login = this.login;
		const transfer: RequestOptions = {
			user: this.user,
			password: login.password,
			keyFile: login.keyFile,
			keyPassphrase: login.keyPassphrase,
			hostKey: login.hostKey,
			ca: login.ca,
			signal: options.signal ?? null,
		};
		const timeout = options.timeout ?? login.timeout;
		if (timeout !== undefined) transfer.timeout = timeout;
		// ftpes: TLS asked for on a plain FTP connection, and required.
		if (this.origin.scheme == "ftpes:") transfer.ssl = "all";
		return transfer;
	}

	/**
	 * The address of `path` as the network client reads it. An absolute path
	 * starts at the server's root, a relative one at the folder of
	 * `ftp.connect`'s address. FTP counts a URL's path from the login folder
	 * (`%2F` is its root); SFTP from the root (`/~` is the login folder).
	 */
	private address(path: string, folder: boolean) {
		const origin = this.origin;
		const scheme = schemeOf(origin.scheme);
		const sftp = scheme == "sftp:";
		const relative = !path.startsWith("/");
		const start = relative ? origin.folder || (sftp ? "/~" : "") : sftp ? "" : "/%2F";
		const rest = encodePath(relative ? path : path.slice(1));
		const joined = rest.length > 0 ? `${start}/${rest}` : start;
		const tail = folder && !joined.endsWith("/") ? "/" : "";
		return `${scheme}//${origin.host}${joined}${tail}`;
	}

	/** Sends a request; its result, or a rejection that says what failed. */
	private async send(action: string, path: string, url: string, transfer: RequestOptions) {
		if (this.closed) throw new Error(`${action} ${path}: the FTP client is closed`);

		const result = await request(url, transfer);
		if (result.errorKind == "") return result;
		throw this.failure(action, path, result, transfer.signal ?? null);
	}

	/** What failed, in words: the action, the path and why - never the password. */
	private failure(action: string, path: string, result: RequestResult, signal: AbortSignal | null) {
		const reason = signal ? signal.reason : null;
		if (result.errorKind == "aborted" && reason) return reason;

		const host = this.origin.host;
		const what = path.length > 0 ? `${action} ${path}` : `${action} ${this.origin.scheme}//${this.user.length > 0 ? `${this.user}@` : ""}${host}`;
		const reply = result.replyCode > 0 ? ` (reply ${result.replyCode})` : "";
		const because = reasonOf(result.errorKind) || `failed: ${result.errorText}`;
		return new Error(this.hidden(`${what}: ${because.replace("{host}", host)}${reply}`));
	}

	/** `text` with the password, should a server repeat it, as `***`. */
	private hidden(text: string) {
		const password = this.login.password ?? "";
		return password.length > 0 ? text.replaceAll(password, "***") : text;
	}
}

/** Why a call failed, by the network client's kind of error; `{host}` is the server. */
function reasonOf(kind: string) {
	switch (kind) {
		case "login":
			return "{host} refused the login - a wrong user, password or key";
		case "denied":
			return "{host} denied it - the account may not do this here";
		case "notFound":
			return "no such file or folder on {host}";
		case "refused":
			return "could not connect to {host} - it is down, unknown or refuses the connection";
		case "timeout":
			return "timed out";
		case "tls":
			return "the secure connection to {host} failed - its certificate or host key is not trusted";
		case "aborted":
			return "aborted";
		default:
			return "";
	}
}

/** The network client's scheme for one `ftp.connect` takes - `ftpes:` is FTP with TLS asked for - or `""`. */
function schemeOf(protocol: string) {
	if (protocol == "ftpes:") return "ftp:";
	return protocol == "ftp:" || protocol == "ftps:" || protocol == "sftp:" ? protocol : "";
}

/**
 * Connects to an FTP, FTPS or SFTP server - `ftp`, imported from
 * `@amxts/ftp`.
 *
 * ```ts
 * import { ftp } from "@amxts/ftp";
 *
 * const client = await ftp.connect("sftp://backup@example.com", { password });
 * ```
 */
export class Ftp {
	/**
	 * Logs in to the server of `url` and gives a client for it; rejects when
	 * the login fails. The scheme says how: `ftp:` plain FTP, `ftpes:` FTP
	 * with TLS asked for (explicit FTPS), `ftps:` TLS from the first byte
	 * (implicit FTPS), `sftp:` SFTP over SSH. A folder in the address is where
	 * relative paths start.
	 *
	 * ```ts
	 * const client = await ftp.connect("ftpes://files.example.com:2121/backup", { user: "cs", password });
	 * ```
	 */
	async connect(url: string, options: FtpOptions = {}) {
		const address = URL.parse(url);
		if (!address) throw new TypeError("ftp.connect: the address is not a URL, e.g. sftp://user@example.com");

		if (schemeOf(address.protocol).length == 0) throw new TypeError(`ftp.connect: ${address.protocol} is not one of ftp:, ftpes:, ftps: or sftp:`);

		const login: FtpOptions = { ...options };
		login.password = options.password ?? decodeURIComponent(address.password);
		const origin: Origin = {
			scheme: address.protocol,
			host: address.host,
			folder: address.pathname.endsWith("/") ? address.pathname.slice(0, -1) : address.pathname,
		};
		const client = new FtpClient(origin, options.user ?? decodeURIComponent(address.username), login);
		await client.__check();
		return client;
	}
}

/** Connects to an FTP, FTPS or SFTP server: `ftp.connect(url, options)`. */
export const ftp = new Ftp();

/** A path's segments percent-encoded, its slashes kept: `"my maps/a#1.bsp"` as `"my%20maps/a%231.bsp"`. */
function encodePath(path: string) {
	return path.split("/").map(encodeURIComponent).join("/");
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

// A Unix listing's line: `drwxr-xr-x 2 owner group 4096 Oct  1 21:05 name`,
// the group left out by some servers, a year in place of the time for an
// older file.
const UNIX_LINE = /^([-bcdlps])\S*\s+\d+\s+\S+(?:\s+\S+)?\s+(\d+)\s+([a-z]{3})\s+(\d{1,2})\s+(\d{1,2}:\d{2}|\d{4})\s+(\S.*)$/i;

// A Windows server's: `10-01-24  09:05PM       <DIR>          name`.
const DOS_LINE = /^(\d{2})-(\d{2})-(\d{2,4})\s+(\d{1,2}):(\d{2})([AP]M)\s+(<DIR>|\d+)\s+(\S.*)$/i;

/** A listing, a line an entry, without `.` and `..`. */
function parseListing(text: string) {
	const entries: FtpEntry[] = [];
	for (const line of text.split("\n")) {
		const entry = parseLine(line.trim());
		if (entry && entry.name != "." && entry.name != "..") entries.push(entry);
	}
	return entries;
}

function parseLine(line: string) {
	const unix = UNIX_LINE.exec(line);
	if (unix) return unixEntry(unix);
	const dos = DOS_LINE.exec(line);
	if (dos) return dosEntry(dos);
	return null;
}

function unixEntry(match: RegExpExecArray) {
	const kind = match[1];
	const month = MONTHS.indexOf(match[3].toLowerCase());
	const day = Number(match[4]);
	const timeOrYear = match[5];
	// A link's line is `name -> target`.
	const name = kind == "l" ? match[6].split(" -> ")[0] : match[6];
	const entry: FtpEntry = { name, size: Number(match[2]), isDirectory: kind == "d", modified: unixDate(month, day, timeOrYear) };
	return entry;
}

/** `Oct  1 21:05` is this year's - last year's if that is still to come; `Oct  1  2023` is that day's. */
function unixDate(month: number, day: number, timeOrYear: string) {
	const colon = timeOrYear.indexOf(":");
	if (colon < 0) return new Date(utc(Number(timeOrYear), month, day, 0, 0));

	const hour = Number(timeOrYear.slice(0, colon));
	const minute = Number(timeOrYear.slice(colon + 1));
	const now = Date.now();
	const year = new Date(now).getUTCFullYear();
	const thisYear = utc(year, month, day, hour, minute);
	// A day ahead allows for the server's time zone.
	return new Date(thisYear > now + 86_400_000 ? utc(year - 1, month, day, hour, minute) : thisYear);
}

function dosEntry(match: RegExpExecArray) {
	const shortYear = Number(match[3]);
	const year = match[3].length == 4 ? shortYear : shortYear < 70 ? 2000 + shortYear : 1900 + shortYear;
	const hour = Number(match[4]) % 12 + (match[6].toUpperCase() == "PM" ? 12 : 0);
	const folder = match[7].toUpperCase() == "<DIR>";
	const modified = new Date(utc(year, Number(match[1]) - 1, Number(match[2]), hour, Number(match[5])));
	const entry: FtpEntry = { name: match[8], size: folder ? 0 : Number(match[7]), isDirectory: folder, modified };
	return entry;
}

/** Milliseconds since 1970 of a UTC time, to the minute. */
function utc(year: number, month: number, day: number, hour: number, minute: number) {
	return Date.UTC(year, month, day, hour, minute, 0, 0);
}
