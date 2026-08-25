# Session Fox

Перетащи `.txt` с куками TikTok → получи готовый профиль Firefox, который открывает **tiktok.com** уже с сессией.

## Быстрый старт без npm (рекомендуется на VM)

Нет места / нет Node? Открой один файл:

1. Скачай [`session-fox-lite.html`](./session-fox-lite.html)
2. Открой в Firefox: `firefox session-fox-lite.html`
3. Кинь `.txt` с куками → **Скачать pack**
4. Распакуй zip и запусти:

```bash
unzip имя-firefox.zip
cd имя
chmod +x open-tiktok.sh
./open-tiktok.sh
```

На Fedora: `sudo dnf install -y firefox`

Интернет нужен только один раз (CDN sql.js + jszip).

---

## Полная версия (npm)

```bash
npm install
cp node_modules/sql.js/dist/sql-wasm.wasm public/sql-wasm.wasm
npm run dev
```

## Что умеет

- Парсит **не JSON**: Netscape `cookies.txt`, строка `Cookie:`, пары `name=value`, `Set-Cookie`
- Zip-pack: `profile/cookies.sqlite` + `user.js` + `Open-TikTok.bat` + `open-tiktok.sh`
- Основной профиль Firefox не трогается (`--no-remote`)

## Важно

- Куки — секрет сессии. Используй только **свои** аккаунты.
