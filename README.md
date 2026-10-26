# m3uwatch

Лёгкий IPTV-клиент для Samsung Tizen TV (проверяется на UE43NU7100, Tizen 4.0).
Чистый ES5, без зависимостей, плеер через `webapis.avplay`, в DOM живут только 14 строк списка.

## Файлы
- `config.xml` — манифест виджета и привилегии
- `config.js` — `PLAYLIST_URL`; пусто = использовать `playlist.m3u` из пакета
- `playlist.m3u` — плейлист (сейчас два тестовых HLS-потока, замени своим)
- `m3u.js`, `app.js`, `index.html`, `style.css` — приложение
- `test_m3u.js` — проверка парсера: `node test_m3u.js`
- `build_epg.py` + `.github/workflows/epg.yml` — раз в 12 часов режут XMLTV провайдера на JSON по каналу и публикуют на GitHub Pages; адрес в `config.js` как `EPG_URL`. Включается один раз: Settings → Pages → Source: GitHub Actions

## Установка на телевизор
SDK ставится расширением **Tizen** для VS Code (оно само скачивает Tizen SDK 10.0 в `~/.tizen-extension-platform`).
В Package Manager расширения на вкладке Extension SDK нужно добавить репозиторий
`https://download.tizen.org/sdk/extensions/tv_extensions/` и установить **TV Extensions-10.0**.

1. На ТВ: Apps → набрать `12345` на пульте → Developer mode ON → IP компьютера → перезагрузить ТВ.
2. Подключиться: `sdb connect <IP ТВ>`, затем `sdb devices` покажет DUID.
3. VS Code → `Tizen: Create Certificate` → Samsung → TV → добавить DUID телевизора в Distributor.
4. Разрешить установку на ТВ (иначе `install failed[118012]`), один раз после создания сертификата:
   ```
   sdb -s <IP ТВ>:26101 push ~/SamsungCertificate/<профиль>/device-profile.xml /home/owner/share/tmp/sdk_tools/device-profile.xml
   ```
5. Собрать, поставить, запустить:
   ```
   TZ=~/.tizen-extension-platform/server/sdktools/data/tools/tizen-core/tz
   $TZ build && $TZ pack -s m3uwatch
   $TZ install -p Debug/m3uwatch.wgt -e <IP ТВ>:26101 && $TZ run -e <IP ТВ>:26101
   ```
   Ненужная привилегия в `config.xml` тоже даёт 118012: список допустимых лежит в SDK в `platforms/tizen-4.0/tv-samsung/privileges`.

## Управление
| Кнопка | В списке | Во время просмотра |
|---|---|---|
| ▲ ▼ | курсор | предыдущий / следующий канал |
| ◀ ▶ | предыдущая / следующая группа | открыть список и сменить группу |
| OK | играть | показать список |
| RETURN | показать видео | показать список |
| EXIT | выход | выход |
| CH+ / CH− | переключить канал | переключить канал |
| 0–9 | номер канала | номер канала |

## Ограничения
- Только HTTP-потоки (HLS, DASH, TS). `udp://` и multicast AVPlay не поддерживает.
- Логотипов нет намеренно: 2000 картинок и есть главный пожиратель памяти в других клиентах.
- EPG телевизор не парсит: он берёт готовый JSON только для текущего канала, пара килобайт.
