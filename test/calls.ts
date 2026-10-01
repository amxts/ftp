// A plugin that drives @amxts/ftp from server commands, one call each, and
// logs what came back - a result, or the rejection's message. ftp.test.ts
// runs the commands against the servers of servers.ts and reads the lines.
import { ftp, FtpClient } from "@amxts/ftp";
import { plugin, server } from "@amxts/core";
import * as fs from "@amxts/core/fs";

plugin({ name: "FTP calls", version: "0.1.0", author: "kukson777", description: "Every call of @amxts/ftp from the console, for the tests" });

interface Login {
	url: string;
	user: string;
	password: string;
}

interface KeyLogin {
	url: string;
	user: string;
	keyFile: string;
	passphrase: string;
	hostKey: string;
}

interface Transfer {
	from: string;
	to: string;
}

interface Remote {
	path: string;
}

interface Folder {
	path?: string;
}

interface Written {
	path: string;
	text: string;
}

/** The client of the last connect: the calls after it use it. */
let client: FtpClient | null = null;

/** The FTPS server's own certificate, which the test puts in the game folder. */
const ca = fs.readFileSync("ca.pem") ?? "";

/** Runs a call and logs `label: what it gave`, or `label error: why it failed`. */
async function logged(label: string, call: () => Promise<string>) {
	try {
		console.log(`${label}: ${await call()}`);
	} catch (error) {
		console.log(`${label} error: ${(error as Error).message}`);
	}
}

server.addServerCommand<Login>("ftp_connect <url> <user> <password>", ({ url, user, password }) => logged("connect", async () => {
	client = await ftp.connect(url, { user, password, ca, timeout: 10_000 });
	return "ok";
}));

server.addServerCommand<KeyLogin>("ftp_key <url> <user> <keyFile> <hostKey> <passphrase>", ({ url, user, keyFile, hostKey, passphrase }) => logged("key", async () => {
	client = await ftp.connect(url, { user, keyFile, keyPassphrase: passphrase, hostKey });
	return "ok";
}));

server.addServerCommand<Login>("ftp_slow <url> <user> <password>", ({ url, user, password }) => logged("slow", async () => {
	await ftp.connect(url, { user, password, timeout: 300 });
	return "ok";
}));

server.addServerCommand<Transfer>("ftp_upload <from> <to>", ({ from, to }) => logged("upload", async () => {
	await client!.upload(from, to);
	return "ok";
}));

server.addServerCommand<Transfer>("ftp_download <from> <to>", ({ from, to }) => logged("download", async () => {
	await client!.download(from, to);
	return "ok";
}));

server.addServerCommand<Remote>("ftp_read <path>", ({ path }) => logged("read", () => client!.readFile(path)));

server.addServerCommand<Written>("ftp_write <path> <text>", ({ path, text }) => logged("write", async () => {
	await client!.writeFile(path, text);
	return "ok";
}));

server.addServerCommand<Folder>("ftp_list [path]", ({ path }) => logged("list", async () => {
	const entries = await client!.list(path);
	return entries.map(entry => `${entry.name} ${entry.size} ${entry.isDirectory ? "dir" : "file"} ${entry.modified.toISOString().slice(0, 16)}`).sort().join(", ");
}));

server.addServerCommand<Remote>("ftp_abort <path>", ({ path }) => logged("abort", async () => {
	const controller = new AbortController();
	const reading = client!.readFile(path, { signal: controller.signal });
	controller.abort();
	return await reading;
}));

server.addServerCommand("ftp_close", () => logged("close", async () => {
	await client!.close();
	return "ok";
}));
