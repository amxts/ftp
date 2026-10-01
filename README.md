<div align="center">

<img src="assets/logo.svg" width="96" alt="FTP">

# FTP

*FTP, FTPS and SFTP for amxts plugins*

[![amxts module](https://img.shields.io/badge/amxts-module-3178c6?style=flat-square)](https://amxts.github.io/)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)

[Features](#features) • [Installation](#installation) • [Usage](#usage) • [API](#api)

**English** | [Русский](README.ru.md)

</div>

Game hosts give access to a server's files over FTP, FTPS or SFTP. This library lets an amxts plugin log in to such a server and upload, download and list files there: a log backed up every night, a map list read from a shared server, a demo sent away after a match.

```ts
import { ftp } from "@amxts/ftp";

const client = await ftp.connect("sftp://backup@example.com", { password });
await client.upload("addons/amxmodx/logs/today.log", "/backup/today.log");
const maps = await client.readFile("/configs/maps.ini");
const entries = await client.list("/configs");             // { name, size, isDirectory, modified }
await client.close();
```

## Features

- **FTP, FTPS and SFTP, by the address.** `ftp://`, `ftpes://` (FTP with TLS asked for - explicit FTPS), `ftps://` (TLS from the first byte - implicit FTPS) and `sftp://`.
- **Never holds the game up.** Every call is a promise; the transfer runs on the server's network client, on a thread of its own, and the promise settles on a later frame.
- **Files byte for byte.** `upload` and `download` move a file of the game folder - a map, a demo, a log - between the disk and the network without it passing through the plugin, whatever its size.
- **A password or a key.** SFTP logs in with a password or a private key, and can check the server's host key.
- **Errors that say what failed.** A wrong password, a missing file, a refused connection or a timeout rejects with an `Error` whose message names the call, the path and the reason - never the password.
- **A timeout and a signal on every call,** as `fetch` has them.

## Installation

Nothing to install on the game server: the network client is part of amxts.

```bash
npx amxts module add ftp
```

It installs the package and adds it to your project's `amxts.config.ts`:

```ts
export default defineConfig({
	modules: ["@amxts/ftp"],
});
```

`@amxts/ftp` is a library: the build compiles it into each plugin that imports it. A plugin imports it by name - `import { ftp } from "@amxts/ftp"` - and each plugin has its own clients.

## Usage

### Where the password goes

The server's address and password are the server owner's, not the plugin's: keep them in a config file beside the server's other configs, and read it with [config-core](https://github.com/amxts/config-core) (`npx amxts module add config-core`):

```yaml
# addons/amxmodx/configs/backup.yaml
url: sftp://backup@files.example.com/cstrike
password: "correct horse battery staple"
```

```ts
import { ftp } from "@amxts/ftp";

interface BackupSettings {
	/** The server and folder to back up to. */
	url: string;
	/** The account's password. */
	password: string;
}

const settings = configs.load<BackupSettings>("backup", { url: "", password: "" });

server.addServerCommand("backup_log", backUpLog);

async function backUpLog() {
	try {
		const client = await ftp.connect(settings.url, { password: settings.password, timeout: 60_000 });
		await client.upload("addons/amxmodx/logs/today.log", "logs/today.log");
		await client.close();
		console.log("backup: done");
	} catch (error) {
		console.error(`backup: ${(error as Error).message}`);
	}
}
```

> [!WARNING]
> **A password in the code goes wherever the code goes** - into git, into a plugin shared with someone else. Keep it in a config file on the server, as above, readable by the server's account only. Prefer an account that may write only to its backup folder; for SFTP, a key (`keyFile`) is better still than a password.

### The address

`ftp.connect(url, options)` logs in and gives a client; it rejects when the login fails.

| Scheme | What it is | Port by default |
| --- | --- | --- |
| `ftp://` | plain FTP: the password and the files go unencrypted | 21 |
| `ftpes://` | FTP with TLS asked for (`AUTH TLS`), required for the commands and the files - explicit FTPS | 21 |
| `ftps://` | TLS from the first byte - implicit FTPS | 990 |
| `sftp://` | SFTP over SSH | 22 |

The user can be in the address (`sftp://backup@example.com`) or in `options.user`, and so can the password, though `options.password` keeps it out of an address you might log. A folder in the address (`sftp://example.com/cstrike`) is where relative paths start; a path that starts with `/` starts at the server's root.

### Files

```ts
await client.upload("demos/match.dem", "demos/match.dem");     // the game folder's file up, its folders made
await client.download("/maps/de_dust2.bsp", "maps/de_dust2.bsp"); // down into the game folder
```

A local path is a path of the game folder (`cstrike/`), as everywhere in amxts. A download that fails leaves a file already there as it was.

Text reads and writes without a file on the game server:

```ts
const maps = await client.readFile("/configs/maps.ini");
await client.writeFile("/status/online.txt", `${Player.all().length}`);
```

### Listing a folder

```ts
const entries = await client.list("/configs");
for (const entry of entries) console.log(`${entry.name} ${entry.isDirectory ? "<dir>" : `${entry.size} B`}`);
```

Each entry is `{ name, size, isDirectory, modified }`: `modified` is a `Date`, to the minute as the server lists it (to the day for a file older than half a year).

### Errors

A call rejects with an `Error` whose message says what failed:

```
download /maps/de_dust3.bsp: no such file or folder on files.example.com
connect ftp://backup@files.example.com: files.example.com refused the login - a wrong user, password or key (reply 530)
upload logs/today.log: timed out
```

The message never holds the password.

### Timeouts and cancelling

```ts
const client = await ftp.connect(url, { password, timeout: 30_000 });   // every call: 30 seconds at most
await client.download("/maps/big.bsp", "maps/big.bsp", { timeout: 300_000 });

const controller = new AbortController();
const pending = client.list("/", { signal: controller.signal });
controller.abort();                                               // rejects with the signal's reason
```

Without a `timeout`, a call has no limit, besides 30 seconds to connect. In an async command handler or a player's event, the player leaving cancels the call.

### SFTP with a key

```ts
const client = await ftp.connect("sftp://backup@files.example.com", {
	keyFile: "addons/amxmodx/data/backup_key",                     // a file of the game folder
	keyPassphrase: settings.keyPassphrase,                          // when the key is encrypted
	hostKey: "nThbg6kXUpJWGl7E1IGOCspRomTxdCARLviKw6E5SY8",        // ssh-keygen -lf, without SHA256:
});
```

> [!WARNING]
> **An SSH key is RSA in PEM:** `ssh-keygen -t rsa -m PEM -f backup_key`. A key in OpenSSH's own format (`BEGIN OPENSSH PRIVATE KEY`, what `ssh-keygen` writes by default) or an Ed25519 key is not read; convert one with `ssh-keygen -p -m PEM -f backup_key`.
>
> **Without `hostKey`, any server key is taken.** Give the fingerprint to be sure the server is the one you mean.

## API

| Member | What it is |
| --- | --- |
| `ftp.connect(url, options?)` | Logs in and gives an `FtpClient`; rejects when the login fails. `options`: `user`, `password`, `keyFile`, `keyPassphrase`, `hostKey`, `ca` (FTPS: the certificate authorities, PEM, for a certificate of the server's own), `timeout` (ms, every call). |
| `client.upload(localPath, remotePath, options?)` | A file of the game folder up, byte for byte, its remote folders made. |
| `client.download(remotePath, localPath, options?)` | A remote file down into the game folder, byte for byte. |
| `client.readFile(remotePath, options?)` | A remote file's text, as UTF-8. |
| `client.writeFile(remotePath, text, options?)` | Text into a remote file, as UTF-8, its remote folders made. |
| `client.list(remotePath?, options?)` | The folder's entries: `{ name, size, isDirectory, modified }`. |
| `client.close()` | Ends the client: a call after it rejects. |

Each call's `options` are `{ timeout, signal }`.
