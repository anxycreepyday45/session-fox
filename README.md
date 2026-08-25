# Session Fox

Перетащи `.txt` с куками TikTok → получи готовый профиль Firefox, который открывает **tiktok.com** уже с сессией.

## Что умеет

- Парсит **не JSON**: Netscape `cookies.txt`, строка `Cookie:`, пары `name=value`, `Set-Cookie`
- Несколько аккаунтов локально (только в браузере)
- Кнопка **Открыть Firefox → tiktok.com** собирает zip:
  - `profile/cookies.sqlite` + `user.js`
  - `Open-TikTok.bat` (Windows)
  - `open-tiktok.sh` (Linux / macOS)
  - `cookies.txt` (backup)

## Запуск

```bash
npm install
# скопируй wasm sql.js в public (после install):
cp node_modules/sql.js/dist/sql-wasm.wasm public/sql-wasm.wasm
npm run dev
```

Сборка:

```bash
npm run build
npm run preview
```

## На виртуальной машине

1. Открой Session Fox в браузере
2. Перетащи `.txt` с куками
3. Нажми **Открыть Firefox → tiktok.com**
4. Распакуй zip → `Open-TikTok.bat` (или `./open-tiktok.sh`)
5. Нужен установленный **Mozilla Firefox**

Страница не может сама запустить Firefox на твоей машине — это ограничение браузера. Архив с профилем и есть «одна кнопка» уже на ВМ.

## Важно

- Куки — секрет сессии. Хранятся только в `localStorage` этого браузера, на сервер не уходят.
- Используй только **свои** аккаунты.
- Основной профиль Firefox не меняется (`-no-remote` + отдельный profile).
