# Changelog

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
