// @amxts/ftp on the fake server, against FTP, FTPS and SFTP servers started in
// this process (servers.ts): calls.ts connects, uploads and downloads files
// of the game folder byte for byte, reads and writes text, lists folders and
// closes, and gets a clear rejection for a wrong password, a missing file, a
// refused connection, a timeout and an abort. The playground's backup plugin
// reads its server and password from a config.
import type { FakeServer } from "@amxts/core/test-utils";
import type { TestServer, TestSftp } from "./servers";
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import type { Stats } from "node:fs";
import { existsSync, mkdirSync, readFileSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { setup } from "@amxts/core/test-utils";
import { KEY_PASSPHRASE, PASSWORD, startTestFtp, startTestSftp, TEST_CA, USER } from "./servers";

setDefaultTimeout(120_000);

let plain: TestServer;
let secure: TestServer;
let sftp: TestSftp;

/** Where the test puts the SFTP key, in the game folder. */
const KEY_FILE = "addons/amxmodx/data/backup_key";

/** Bytes no text decoder keeps as they are: a file that must travel untouched. */
const BINARY = new Uint8Array(70_000).map((_, i) => (i * 7 + 3) % 256);

beforeAll(async () => {
	[plain, secure, sftp] = await Promise.all([startTestFtp(), startTestFtp(true), startTestSftp()]);
});

afterAll(async () => {
	await Promise.all([plain?.stop(), secure?.stop(), sftp?.stop()]);
});

/** A fake server with calls.ts, the FTPS certificate, the SFTP key and a map to send. */
async function start() {
	const server = await setup({ rootDir: "playground", plugins: [], start: false, files: { "ca.pem": TEST_CA, [KEY_FILE]: sftp.privateKey } });
	await server.load("test/calls.ts");
	server.start();
	server.files.set("maps/test.bsp", BINARY);
	return server;
}

/** Runs a command, lets its requests come back, and gives the lines it logged. */
async function run(server: FakeServer, command: string) {
	const from = server.logLines.length;
	server.serverCommand(command);
	await server.responses();
	return server.logLines.slice(from);
}

/** A line of a Windows server's listing: `10-01-24  09:05PM       <DIR>          maps`. */
function dosLine(stat: Stats & { name: string }) {
	const at = stat.mtime;
	const two = (value: number) => String(value).padStart(2, "0");
	const hour = at.getUTCHours() % 12 || 12;
	const date = `${two(at.getUTCMonth() + 1)}-${two(at.getUTCDate())}-${two(at.getUTCFullYear() % 100)}  ${two(hour)}:${two(at.getUTCMinutes())}${at.getUTCHours() < 12 ? "AM" : "PM"}`;
	return `${date}       ${stat.isDirectory() ? "<DIR>         " : String(stat.size).padStart(14)} ${stat.name}`;
}

/** A port nobody listens on. */
async function closedPort() {
	const probe = createServer();
	await new Promise<void>(resolve => probe.listen(0, "127.0.0.1", resolve));
	const { port } = probe.address() as { port: number };
	await new Promise(resolve => probe.close(resolve));
	return port;
}

describe.each([
	["FTP", () => plain],
	["FTPS", () => secure],
	["SFTP", () => sftp],
])("%s", (_, remote) => {
	test("connect, a file up and down byte for byte, text both ways, a listing, close", async () => {
		const server = await start();
		const { url, root } = remote();

		expect(await run(server, `ftp_connect ${url} ${USER} ${PASSWORD}`)).toEqual(["connect: ok"]);
		expect(await run(server, "ftp_upload maps/test.bsp /maps/test.bsp")).toEqual(["upload: ok"]);
		expect(new Uint8Array(readFileSync(join(root, "maps/test.bsp")))).toEqual(BINARY);
		expect(await run(server, "ftp_download /maps/test.bsp maps/copy.bsp")).toEqual(["download: ok"]);
		expect(server.files.get("maps/copy.bsp")).toEqual(BINARY);

		expect(await run(server, "ftp_write /configs/note.txt Привет")).toEqual(["write: ok"]);
		expect(readFileSync(join(root, "configs/note.txt"), "utf8")).toBe("Привет");
		expect(await run(server, "ftp_read /configs/note.txt")).toEqual(["read: Привет"]);

		expect((await run(server, "ftp_list /"))[0]).toMatch(/^list: configs \d+ dir \d{4}-\d\d-\d\dT\d\d:\d\d, maps \d+ dir \d{4}-\d\d-\d\dT\d\d:\d\d$/);
		expect(await run(server, "ftp_list /maps")).toEqual([expect.stringMatching(/^list: test\.bsp 70000 file \d{4}-\d\d-\d\dT\d\d:\d\d$/)]);

		expect(await run(server, "ftp_close")).toEqual(["close: ok"]);
		expect(await run(server, "ftp_read /configs/note.txt")).toEqual(["read error: readFile /configs/note.txt: the FTP client is closed"]);
	});

	test("a wrong password, a missing file, an abort: clear rejections without the password", async () => {
		const server = await start();
		const { url } = remote();
		const host = url.replace(/^\w+:\/\//, "");

		const wrong = await run(server, `ftp_connect ${url} ${USER} hunter2`);
		expect(wrong).toEqual([expect.stringContaining(`connect error: connect ${url.replace("://", `://${USER}@`)}: ${host} refused the login`)]);
		expect(wrong[0]).not.toContain("hunter2");

		await run(server, `ftp_connect ${url} ${USER} ${PASSWORD}`);
		const missing = await run(server, "ftp_read /nowhere/missing.txt");
		expect(missing).toEqual([expect.stringMatching(/^read error: readFile \/nowhere\/missing\.txt: /)]);
		expect(missing[0]).toMatch(/no such file or folder|denied it/);
		// ftp-srv answers a missing file with 551, not FTP's 550: the server's own words then.
		expect(await run(server, "ftp_read /missing.txt")).toEqual([expect.stringMatching(/^read error: readFile \/missing\.txt: .*no such file/i)]);

		expect(await run(server, "ftp_abort /configs/note.txt")).toEqual([expect.stringMatching(/^abort error: /)]);
	});
});

describe("errors before a login", () => {
	test("a refused connection and a timeout", async () => {
		const server = await start();
		const port = await closedPort();
		expect(await run(server, `ftp_connect ftp://127.0.0.1:${port} ${USER} ${PASSWORD}`)).toEqual([`connect error: connect ftp://${USER}@127.0.0.1:${port}: could not connect to 127.0.0.1:${port} - it is down, unknown or refuses the connection`]);

		const silent = createServer(() => {});
		await new Promise<void>(resolve => silent.listen(0, "127.0.0.1", resolve));
		const quiet = (silent.address() as { port: number }).port;
		try {
			expect(await run(server, `ftp_slow ftp://127.0.0.1:${quiet} ${USER} ${PASSWORD}`)).toEqual([`slow error: connect ftp://${USER}@127.0.0.1:${quiet}: timed out`]);
		} finally {
			silent.close();
		}
	});

	test("an address that is not FTP's", async () => {
		const server = await start();
		expect(await run(server, `ftp_connect https://example.com ${USER} ${PASSWORD}`)).toEqual(["connect error: ftp.connect: https: is not one of ftp:, ftpes:, ftps: or sftp:"]);
	});
});

describe("SFTP with a key", () => {
	test("an encrypted key, the host key checked: the right one taken, another refused", async () => {
		const server = await start();
		mkdirSync(join(sftp.root, "keyed"), { recursive: true });
		writeFileSync(join(sftp.root, "keyed/x.txt"), "x");

		expect(await run(server, `ftp_key ${sftp.url} ${USER} ${KEY_FILE} ${sftp.hostKey} ${KEY_PASSPHRASE}`)).toEqual(["key: ok"]);
		expect(await run(server, "ftp_list /keyed")).toEqual([`list: x.txt 1 file ${new Date().getUTCFullYear()}-01-01T00:00`]);

		const other = `${sftp.hostKey.slice(0, -4)}AAAA`;
		expect(await run(server, `ftp_key ${sftp.url} ${USER} ${KEY_FILE} ${other} ${KEY_PASSPHRASE}`)).toEqual([expect.stringMatching(/^key error: connect sftp:\/\/amxts@127\.0\.0\.1:\d+: the secure connection to .* failed - its certificate or host key is not trusted$/)]);
	});
});

describe("listings", () => {
	test("Unix lines: a recent file to the minute, an older one to the day, a folder of the address", async () => {
		const server = await start();
		mkdirSync(join(plain.root, "listing"));
		writeFileSync(join(plain.root, "listing/new.txt"), "new");
		writeFileSync(join(plain.root, "listing/old.txt"), "old");
		utimesSync(join(plain.root, "listing/old.txt"), new Date("2020-05-03T10:20:00Z"), new Date("2020-05-03T10:20:00Z"));
		const recent = statSync(join(plain.root, "listing/new.txt")).mtime.toISOString().slice(0, 16);

		await run(server, `ftp_connect ${plain.url}/listing ${USER} ${PASSWORD}`);
		expect(await run(server, "ftp_list")).toEqual([`list: new.txt 3 file ${recent}, old.txt 3 file 2020-05-03T00:00`]);
	});

	test("a Windows server's lines", async () => {
		const windows = await startTestFtp(false, dosLine);
		try {
			const server = await start();
			mkdirSync(join(windows.root, "maps"));
			writeFileSync(join(windows.root, "maps.ini"), "de_dust2");
			utimesSync(join(windows.root, "maps.ini"), new Date("2024-10-01T21:05:00Z"), new Date("2024-10-01T21:05:00Z"));
			utimesSync(join(windows.root, "maps"), new Date("2024-10-01T09:05:00Z"), new Date("2024-10-01T09:05:00Z"));

			await run(server, `ftp_connect ${windows.url} ${USER} ${PASSWORD}`);
			expect(await run(server, "ftp_list /")).toEqual(["list: maps 0 dir 2024-10-01T09:05, maps.ini 8 file 2024-10-01T21:05"]);
		} finally {
			await windows.stop();
		}
	});
});

describe("the playground's backup plugin", () => {
	test("reads its server and password from configs/backup.yaml and backs the log up", async () => {
		const server = await setup({
			rootDir: "playground",
			files: {
				"addons/amxmodx/configs/backup.yaml": `url: ${sftp.url.replace("://", `://${USER}@`)}/backup\npassword: ${PASSWORD}\n`,
				"addons/amxmodx/logs/today.log": "L 10/01/2026 - 21:00:00: Server started\n",
			},
		});
		const from = server.logLines.length;
		server.serverCommand("backup_log");
		await server.responses();
		expect(server.logLines.slice(from).join("\n")).toContain("backup: done - today.log");
		expect(existsSync(join(sftp.root, "backup/logs/today.log"))).toBe(true);
	});
});
