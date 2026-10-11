# Changelog

## v0.1.1

> FTP for amxts 0.2 and 0.3.

This release only widens the core it works with to `@amxts/core` `^0.2.0 || ^0.3.0`, so it can be upgraded together with your project. Nothing else changes.

### 👉 Changelog

[compare changes](https://github.com/amxts/ftp/compare/v0.1.0...v0.1.1)

### ❤️ Contributors

- Ernest Manukyan ([@kukson777](https://github.com/kukson777))

## v0.1.0

The first release: FTP, FTPS and SFTP for amxts plugins. Upload, download and list files on another server; every call is a promise on amxts's network thread, so the game never waits, and files go between the game folder and the other server whole, binary included.

```ts
import { ftp } from "@amxts/ftp";

const client = await ftp.connect("sftp://backup@example.com", { password: settings.password });
await client.upload("addons/amxmodx/logs/today.log", "logs/today.log");
await client.close();
```

SFTP takes a password or an RSA key in PEM, and can check the host's key.

### ❤️ Contributors

- Ernest Manukyan ([@kukson777](https://github.com/kukson777))
