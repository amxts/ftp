import { ftp } from "@amxts/ftp";

plugin({ name: "Backup", version: "0.1.0", author: "kukson777", description: "Tries @amxts/ftp out: the day's log backed up to another server, its folder listed" });

interface BackupSettings {
	/** The server and folder to back up to, e.g. `sftp://backup@example.com/cstrike`. */
	url: string;
	/** The account's password. */
	password: string;
}

// configs/backup.yaml, beside the server's other configs - not in the code.
const settings = configs.load<BackupSettings>("backup", { url: "", password: "" });

server.addServerCommand("backup_log", backUpLog);

async function backUpLog() {
	try {
		const client = await ftp.connect(settings.url, { password: settings.password, timeout: 60_000 });
		await client.upload("addons/amxmodx/logs/today.log", "logs/today.log");
		const names = (await client.list("logs")).map(entry => `${entry.name} (${entry.size} B)`);
		await client.close();
		console.log(`backup: done - ${names.join(", ")}`);
	} catch (error) {
		console.error(`backup: ${(error as Error).message}`);
	}
}
