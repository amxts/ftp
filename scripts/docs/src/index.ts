// The tooltips of src/index.ts, in both languages: scripts/apply-docs.ts writes the
// one AMXTS_DOCS_LANG picks into the JSDoc above each element.
export default {
	'FtpOptions': {
		en: `How \`ftp.connect\` logs in, and what every call of the client takes by default.`,
		ru: `Как \`ftp.connect\` входит на сервер и что каждый вызов клиента берёт по умолчанию.`,
	},
	'FtpOptions.user': {
		en: `The user to log in as; the address's own (\`sftp://admin@example.com\`) when left out.`,
		ru: `Пользователь для входа; если не указан — из адреса (\`sftp://admin@example.com\`).`,
	},
	'FtpOptions.password': {
		en: `The password to log in with; the address's own when left out.`,
		ru: `Пароль для входа; если не указан — из адреса.`,
	},
	'FtpOptions.keyFile': {
		en: `
			SFTP: the private key to log in with, a file of the game folder
			(\`addons/amxmodx/data/backup_key\`) - an RSA key in PEM.
		`,
		ru: `
			SFTP: закрытый ключ для входа, файл игровой папки
			(\`addons/amxmodx/data/backup_key\`), — ключ RSA в PEM.
		`,
	},
	'FtpOptions.keyPassphrase': {
		en: `SFTP: the passphrase \`keyFile\` is encrypted with.`,
		ru: `SFTP: пароль, которым зашифрован \`keyFile\`.`,
	},
	'FtpOptions.hostKey': {
		en: `
			SFTP: the server's host key, its SHA-256 fingerprint in base64 as
			\`ssh-keygen -lf\` prints it, without \`SHA256:\`. A server with another key
			is refused; left out, any host key is taken.
		`,
		ru: `
			SFTP: ключ хоста сервера — его отпечаток SHA-256 в base64, как его печатает
			\`ssh-keygen -lf\`, без \`SHA256:\`. Сервер с другим ключом отвергается;
			если не указан, принимается любой ключ хоста.
		`,
	},
	'FtpOptions.ca': {
		en: `
			FTPS: the certificate authorities the server's certificate must come
			from, as PEM text - for a server with a certificate of its own making.
			Left out, the ones a browser trusts.
		`,
		ru: `
			FTPS: удостоверяющие центры, которыми должен быть выдан сертификат
			сервера, текстом PEM, — для сервера с самодельным сертификатом.
			Если не указаны — те, которым доверяет браузер.
		`,
	},
	'FtpOptions.timeout': {
		en: `Milliseconds each call may take before it fails; no limit by default.`,
		ru: `Сколько миллисекунд может длиться каждый вызов, прежде чем он завершится ошибкой; по умолчанию без ограничения.`,
	},
	'FtpCallOptions': {
		en: `One call's own options: \`upload\`'s, \`download\`'s and the others' last argument.`,
		ru: `Параметры одного вызова: последний аргумент \`upload\`, \`download\` и остальных.`,
	},
	'FtpCallOptions.timeout': {
		en: `Milliseconds this call may take before it fails; the client's \`timeout\` when left out.`,
		ru: `Сколько миллисекунд может длиться этот вызов, прежде чем он завершится ошибкой; если не указано — \`timeout\` клиента.`,
	},
	'FtpCallOptions.signal': {
		en: `A signal that cancels the call; the promise then rejects with the signal's reason.`,
		ru: `Сигнал, отменяющий вызов; промис тогда отклоняется с причиной сигнала.`,
	},
	'FtpEntry': {
		en: `A file or a folder in a listing.`,
		ru: `Файл или папка в списке.`,
	},
	'FtpEntry.name': {
		en: `The entry's name, without its folder, e.g. \`"maps.ini"\`.`,
		ru: `Имя записи без папки, например \`"maps.ini"\`.`,
	},
	'FtpEntry.size': {
		en: `The entry's size in bytes; a folder's as the server gives it.`,
		ru: `Размер записи в байтах; у папки — какой даёт сервер.`,
	},
	'FtpEntry.isDirectory': {
		en: `\`true\` for a folder.`,
		ru: `\`true\` для папки.`,
	},
	'FtpEntry.modified': {
		en: `The entry's last change, as the server lists it: to the minute, or to the day for an older file.`,
		ru: `Время последнего изменения записи, как его даёт сервер: с точностью до минуты, у старого файла — до дня.`,
	},
	'FtpClient': {
		en: `
			A connection to an FTP, FTPS or SFTP server, from \`ftp.connect\`. Every call
			returns a promise and runs on the server's network client.

			\`\`\`ts
			await client.upload("addons/amxmodx/logs/today.log", "/backup/today.log");
			const entries = await client.list("/backup");
			await client.close();
			\`\`\`
		`,
		ru: `
			Подключение к серверу FTP, FTPS или SFTP из \`ftp.connect\`. Каждый вызов
			возвращает промис и выполняется сетевым клиентом сервера.

			\`\`\`ts
			await client.upload("addons/amxmodx/logs/today.log", "/backup/today.log");
			const entries = await client.list("/backup");
			await client.close();
			\`\`\`
		`,
	},
	'FtpClient.upload': {
		en: `
			Sends a file of the game folder to \`remotePath\`, byte for byte - a log, a
			map, a demo - making the remote folders that are not there.

			\`\`\`ts
			await client.upload("addons/amxmodx/logs/today.log", "/backup/today.log");
			\`\`\`
		`,
		ru: `
			Отправляет файл игровой папки в \`remotePath\` байт в байт — лог, карту,
			демо, — создавая удалённые папки, которых нет.

			\`\`\`ts
			await client.upload("addons/amxmodx/logs/today.log", "/backup/today.log");
			\`\`\`
		`,
	},
	'FtpClient.download': {
		en: `
			Fetches \`remotePath\` into a file of the game folder, byte for byte. A
			download that fails leaves a file already there as it was.

			\`\`\`ts
			await client.download("/maps/de_dust2.bsp", "maps/de_dust2.bsp");
			\`\`\`
		`,
		ru: `
			Скачивает \`remotePath\` в файл игровой папки байт в байт. Неудачная
			загрузка оставляет уже существующий файл как был.

			\`\`\`ts
			await client.download("/maps/de_dust2.bsp", "maps/de_dust2.bsp");
			\`\`\`
		`,
	},
	'FtpClient.readFile': {
		en: `
			The text of \`remotePath\`, read as UTF-8 - a config, a list.

			\`\`\`ts
			const maps = await client.readFile("/configs/maps.ini");
			\`\`\`
		`,
		ru: `
			Текст \`remotePath\`, прочитанный как UTF-8, — конфиг, список.

			\`\`\`ts
			const maps = await client.readFile("/configs/maps.ini");
			\`\`\`
		`,
	},
	'FtpClient.writeFile': {
		en: `
			Writes \`text\` to \`remotePath\` as UTF-8, in place of what was there,
			making the remote folders that are not there.

			\`\`\`ts
			await client.writeFile("/status/online.txt", \`\${Player.all().length}\`);
			\`\`\`
		`,
		ru: `
			Записывает \`text\` в \`remotePath\` как UTF-8 вместо того, что там было,
			создавая удалённые папки, которых нет.

			\`\`\`ts
			await client.writeFile("/status/online.txt", \`\${Player.all().length}\`);
			\`\`\`
		`,
	},
	'FtpClient.list': {
		en: `
			The files and folders in \`remotePath\` - the folder of \`ftp.connect\`'s
			address when left out.

			\`\`\`ts
			const entries = await client.list("/configs");
			const big = entries.filter((entry) => !entry.isDirectory && entry.size > 1_000_000);
			\`\`\`
		`,
		ru: `
			Файлы и папки в \`remotePath\`; если путь не указан — в папке адреса
			\`ftp.connect\`.

			\`\`\`ts
			const entries = await client.list("/configs");
			const big = entries.filter((entry) => !entry.isDirectory && entry.size > 1_000_000);
			\`\`\`
		`,
	},
	'FtpClient.close': {
		en: `Ends the client: a call after it rejects.`,
		ru: `Закрывает клиент: вызов после этого отклоняется.`,
	},
	'Ftp': {
		en: `
			Connects to an FTP, FTPS or SFTP server - \`ftp\`, imported from
			\`@amxts/ftp\`.

			\`\`\`ts
			import { ftp } from "@amxts/ftp";

			const client = await ftp.connect("sftp://backup@example.com", { password });
			\`\`\`
		`,
		ru: `
			Подключается к серверу FTP, FTPS или SFTP — \`ftp\`, импортированный из
			\`@amxts/ftp\`.

			\`\`\`ts
			import { ftp } from "@amxts/ftp";

			const client = await ftp.connect("sftp://backup@example.com", { password });
			\`\`\`
		`,
	},
	'Ftp.connect': {
		en: `
			Logs in to the server of \`url\` and gives a client for it; rejects when
			the login fails. The scheme says how: \`ftp:\` plain FTP, \`ftpes:\` FTP
			with TLS asked for (explicit FTPS), \`ftps:\` TLS from the first byte
			(implicit FTPS), \`sftp:\` SFTP over SSH. A folder in the address is where
			relative paths start.

			\`\`\`ts
			const client = await ftp.connect("ftpes://files.example.com:2121/backup", { user: "cs", password });
			\`\`\`
		`,
		ru: `
			Входит на сервер \`url\` и даёт клиент для него; отклоняется, если вход не
			удался. Схема говорит как: \`ftp:\` — обычный FTP, \`ftpes:\` — FTP с
			запросом TLS (явный FTPS), \`ftps:\` — TLS с первого байта (неявный
			FTPS), \`sftp:\` — SFTP поверх SSH. Папка в адресе — то, откуда
			начинаются относительные пути.

			\`\`\`ts
			const client = await ftp.connect("ftpes://files.example.com:2121/backup", { user: "cs", password });
			\`\`\`
		`,
	},
	'ftp': {
		en: `Connects to an FTP, FTPS or SFTP server: \`ftp.connect(url, options)\`.`,
		ru: `Подключается к серверу FTP, FTPS или SFTP: \`ftp.connect(url, options)\`.`,
	},
};
