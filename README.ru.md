<div align="center">

<img src="assets/logo.svg" width="96" alt="FTP">

# FTP

*FTP, FTPS и SFTP для плагинов amxts*

[![amxts module](https://img.shields.io/badge/amxts-module-3178c6?style=flat-square)](https://amxts.github.io/)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)

[Возможности](#возможности) • [Установка](#установка) • [Использование](#использование) • [API](#api)

[English](README.md) | **Русский**

</div>

Игровые хостинги дают доступ к файлам сервера по FTP, FTPS или SFTP. Эта библиотека позволяет плагину amxts войти на такой сервер и загружать, скачивать и перечислять там файлы: лог, который каждую ночь уходит в резервную копию, список карт с общего сервера, демо, отправленное после матча.

```ts
import { ftp } from "@amxts/ftp";

const client = await ftp.connect("sftp://backup@example.com", { password });
await client.upload("addons/amxmodx/logs/today.log", "/backup/today.log");
const maps = await client.readFile("/configs/maps.ini");
const entries = await client.list("/configs");             // { name, size, isDirectory, modified }
await client.close();
```

## Возможности

- **FTP, FTPS и SFTP — по адресу.** `ftp://`, `ftpes://` (FTP с запросом TLS — явный FTPS), `ftps://` (TLS с первого байта — неявный FTPS) и `sftp://`.
- **Никогда не держит игру.** Каждый вызов — промис; передача идёт в сетевом клиенте сервера, в отдельном потоке, а промис выполняется на одном из следующих кадров.
- **Файлы байт в байт.** `upload` и `download` переносят файл игровой папки — карту, демо, лог — между диском и сетью, не пропуская его через плагин, какого бы размера он ни был.
- **Пароль или ключ.** SFTP входит по паролю или закрытому ключу и может проверить ключ хоста сервера.
- **Ошибки говорят, что не так.** Неверный пароль, отсутствующий файл, отказ в соединении или таймаут отклоняют промис с `Error`, в сообщении которого — вызов, путь и причина, но никогда не пароль.
- **Таймаут и сигнал у каждого вызова,** как у `fetch`.

## Установка

На игровой сервер ничего ставить не нужно: сетевой клиент — часть amxts.

```bash
npx amxts module add ftp
```

Команда ставит пакет и добавляет его в `amxts.config.ts` проекта:

```ts
export default defineConfig({
	modules: ["@amxts/ftp"],
});
```

`@amxts/ftp` — библиотека: сборка компилирует её в каждый плагин, который её импортирует. Плагин импортирует её по имени — `import { ftp } from "@amxts/ftp"`, — и у каждого плагина свои клиенты.

## Использование

### Где хранить пароль

Адрес сервера и пароль принадлежат владельцу сервера, а не плагину: храните их в конфиге рядом с остальными конфигами сервера и читайте его через [config-core](https://github.com/amxts/config-core) (`npx amxts module add config-core`):

```yaml
# addons/amxmodx/configs/backup.yaml
url: sftp://backup@files.example.com/cstrike
password: "correct horse battery staple"
```

```ts
import { ftp } from "@amxts/ftp";

interface BackupSettings {
	/** Сервер и папка для резервных копий. */
	url: string;
	/** Пароль учётной записи. */
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
		console.error(`backup: ${error.message}`);
	}
}
```

> [!WARNING]
> **Пароль в коде уходит туда же, куда и код** — в git, в плагин, которым поделились с кем-то ещё. Храните его в конфиге на сервере, как выше, доступном для чтения только учётной записи сервера. Лучше учётная запись, которая может писать только в свою папку для копий; для SFTP ключ (`keyFile`) ещё лучше пароля.

### Адрес

`ftp.connect(url, options)` входит на сервер и даёт клиент; промис отклоняется, если вход не удался.

| Схема | Что это | Порт по умолчанию |
| --- | --- | --- |
| `ftp://` | обычный FTP: пароль и файлы идут без шифрования | 21 |
| `ftpes://` | FTP с запросом TLS (`AUTH TLS`), обязательным для команд и файлов, — явный FTPS | 21 |
| `ftps://` | TLS с первого байта — неявный FTPS | 990 |
| `sftp://` | SFTP поверх SSH | 22 |

Пользователь может быть в адресе (`sftp://backup@example.com`) или в `options.user`, как и пароль, хотя `options.password` не даёт ему попасть в адрес, который может оказаться в логе. Папка в адресе (`sftp://example.com/cstrike`) — то, откуда начинаются относительные пути; путь, начинающийся с `/`, начинается от корня сервера.

### Файлы

```ts
await client.upload("demos/match.dem", "demos/match.dem");     // файл игровой папки наверх, его папки создаются
await client.download("/maps/de_dust2.bsp", "maps/de_dust2.bsp"); // вниз, в игровую папку
```

Локальный путь — путь игровой папки (`cstrike/`), как и везде в amxts. Неудачное скачивание оставляет уже существующий файл как был.

Текст читается и пишется без файла на игровом сервере:

```ts
const maps = await client.readFile("/configs/maps.ini");
await client.writeFile("/status/online.txt", `${server.players.length}`);
```

### Содержимое папки

```ts
const entries = await client.list("/configs");
for (const entry of entries) console.log(`${entry.name} ${entry.isDirectory ? "<dir>" : `${entry.size} B`}`);
```

Каждая запись — `{ name, size, isDirectory, modified }`: `modified` — `Date` с точностью до минуты, как её даёт сервер (до дня у файла старше полугода).

### Ошибки

Вызов отклоняется с `Error`, в сообщении которого сказано, что не так:

```
download /maps/de_dust3.bsp: no such file or folder on files.example.com
connect ftp://backup@files.example.com: files.example.com refused the login - a wrong user, password or key (reply 530)
upload logs/today.log: timed out
```

Пароля в сообщении нет никогда.

### Таймауты и отмена

```ts
const client = await ftp.connect(url, { password, timeout: 30_000 });   // каждый вызов — не дольше 30 секунд
await client.download("/maps/big.bsp", "maps/big.bsp", { timeout: 300_000 });

const controller = new AbortController();
const pending = client.list("/", { signal: controller.signal });
controller.abort();                                               // отклоняется с причиной сигнала
```

Без `timeout` у вызова нет ограничения, кроме 30 секунд на соединение. В асинхронном обработчике команды или события игрока уход игрока отменяет вызов.

### SFTP с ключом

```ts
const client = await ftp.connect("sftp://backup@files.example.com", {
	keyFile: "addons/amxmodx/data/backup_key",                     // файл игровой папки
	keyPassphrase: settings.keyPassphrase,                          // если ключ зашифрован
	hostKey: "nThbg6kXUpJWGl7E1IGOCspRomTxdCARLviKw6E5SY8",        // ssh-keygen -lf, без SHA256:
});
```

> [!WARNING]
> **Ключ SSH — RSA в PEM:** `ssh-keygen -t rsa -m PEM -f backup_key`. Ключ в собственном формате OpenSSH (`BEGIN OPENSSH PRIVATE KEY`, его `ssh-keygen` пишет по умолчанию) или ключ Ed25519 не читается; переведите его командой `ssh-keygen -p -m PEM -f backup_key`.
>
> **Без `hostKey` принимается любой ключ сервера.** Укажите отпечаток, чтобы быть уверенным, что сервер — тот самый.

## API

| Член | Что это |
| --- | --- |
| `ftp.connect(url, options?)` | Входит на сервер и даёт `FtpClient`; отклоняется, если вход не удался. `options`: `user`, `password`, `keyFile`, `keyPassphrase`, `hostKey`, `ca` (FTPS: удостоверяющие центры, PEM, для собственного сертификата сервера), `timeout` (мс, каждый вызов). |
| `client.upload(localPath, remotePath, options?)` | Файл игровой папки наверх байт в байт, удалённые папки создаются. |
| `client.download(remotePath, localPath, options?)` | Удалённый файл вниз, в игровую папку, байт в байт. |
| `client.readFile(remotePath, options?)` | Текст удалённого файла как UTF-8. |
| `client.writeFile(remotePath, text, options?)` | Текст в удалённый файл как UTF-8, удалённые папки создаются. |
| `client.list(remotePath?, options?)` | Записи папки: `{ name, size, isDirectory, modified }`. |
| `client.close()` | Закрывает клиент: вызов после этого отклоняется. |

`options` каждого вызова — `{ timeout, signal }`.
