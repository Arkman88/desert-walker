# Автоматический деплой desert-walker.ru

Push в `main` запускает `npm ci`, `npm run build` (TypeScript + Vite) и загрузку
`dist` по SSH на Ubuntu. Pull request запускает только сборку. Ручной запуск:
GitHub → Actions → Build and deploy → Run workflow, ветка `main`.

Полный `npm test` пока не является условием деплоя: существующий `test-hut`
падает из-за отсутствующего `public/textures/desert_hut/adobe_basecolor.png`.
После восстановления ресурсов следует добавить `npm test` перед сборкой.

## 1. Один раз подготовить сервер

Подключиться к серверу по SSH пользователем с sudo. Сначала проверить занятость
портов: `sudo ss -ltnp | grep -E ':(80|443)\b'`. Если работает другой веб-сервер,
сначала согласовать его конфигурацию, чтобы не создавать конфликт с Nginx.

```bash
sudo apt update
sudo apt install -y nginx rsync
sudo adduser --disabled-password --gecos '' deploy
sudo install -d -o deploy -g deploy -m 755 /var/www/desert-walker
sudo install -d -o deploy -g deploy -m 700 /home/deploy/.ssh
```

Если `deploy` уже существует, повторно создавать пользователя не нужно.
Если папка сайта уже создана другим пользователем, передать её пользователю deploy:

```bash
sudo chown -R deploy:deploy /var/www/desert-walker
```

## 2. SSH-ключ для GitHub Actions

На своём Mac создать отдельный ключ без пароля (не перезаписывать существующий):

```bash
ssh-keygen -t ed25519 -C 'github-actions-desert-walker' -f ~/.ssh/desert-walker-actions -N ''
cat ~/.ssh/desert-walker-actions.pub
```

Скопировать показанную публичную строку и на сервере добавить её вместо
`PASTE_PUBLIC_KEY`:

```bash
printf '%s\n' 'restrict PASTE_PUBLIC_KEY' | sudo tee -a /home/deploy/.ssh/authorized_keys > /dev/null
sudo chown deploy:deploy /home/deploy/.ssh/authorized_keys
sudo chmod 600 /home/deploy/.ssh/authorized_keys
```

Деплой рассчитан на стандартный SSH-порт 22 и пользователя deploy без sudo.
В конфигурации sshd должна быть разрешена аутентификация пользователя deploy ключом.

## 3. GitHub Secrets

Открыть https://github.com/Arkman88/desert-walker/settings/secrets/actions
и добавить четыре Repository secrets:

| Secret | Значение |
| --- | --- |
| `DEPLOY_HOST` | IP сервера, без протокола и порта |
| `DEPLOY_USER` | `deploy` |
| `DEPLOY_SSH_KEY` | Всё содержимое `~/.ssh/desert-walker-actions`, включая BEGIN/END |
| `DEPLOY_KNOWN_HOSTS` | Проверенная строка ключа сервера из команды ниже |

На сервере получить публичный ключ хоста через уже доверенное SSH-соединение
или консоль провайдера, заменив SERVER_IP на тот же IP, что указан в DEPLOY_HOST:

```bash
printf 'SERVER_IP '
cat /etc/ssh/ssh_host_ed25519_key.pub
```

Скопировать всю получившуюся строку в `DEPLOY_KNOWN_HOSTS`.
Приватный ключ не добавлять в Git и не отправлять в чат.

## 4. Nginx и домен

DNS A-запись `desert-walker.ru` должна указывать на IP сервера. Если есть AAAA,
она должна соответствовать IPv6 этого сервера. Разрешить TCP 22, 80, 443 в панели
провайдера. При активном UFW разрешить сайт: `sudo ufw allow 'Nginx Full'`.

Загрузить `deploy/nginx.conf` из этого репозитория на сервер и установить:

```bash
sudo cp nginx.conf /etc/nginx/sites-available/desert-walker
sudo ln -sfn /etc/nginx/sites-available/desert-walker /etc/nginx/sites-enabled/desert-walker
sudo nginx -t && sudo systemctl enable --now nginx && sudo systemctl reload nginx
```

Например, загрузить конфигурацию с Mac из корня проекта:
`scp deploy/nginx.conf USER@SERVER_IP:nginx.conf`.

Запустить workflow и проверить http://desert-walker.ru. Затем на сервере:

```bash
sudo apt install -y snapd
sudo snap install --classic certbot
sudo /snap/bin/certbot --nginx -d desert-walker.ru --redirect
sudo /snap/bin/certbot renew --dry-run
```

Не перезаписывать конфигурацию Nginx исходным файлом после настройки HTTPS:
Certbot добавляет в неё настройки сертификата.

## Обновления и ограничения

Далее достаточно push в `main`. Node.js на сервере не нужен; Nginx продолжает
работать без перезапуска. Сначала копируются ресурсы, затем `index.html`, поэтому
новый HTML публикуется только после успешной загрузки ресурсов. Старые файлы
не удаляются: открытые вкладки могут продолжить загружать старые хешированные
ресурсы. Они занимают место на сервере; очистку нужно выполнять отдельно с учётом
активных версий. Загрузка ресурсов с неизменными именами не атомарна.

Без secrets и подготовки сервера сборка проходит, но шаг деплоя завершится
ошибкой с именем отсутствующей настройки. Статус и журнал доступны во вкладке Actions.

Справка: [GitHub setup-node](https://github.com/actions/setup-node),
[Nginx try_files](https://nginx.org/en/docs/http/ngx_http_core_module.html#try_files),
[Certbot для Nginx](https://certbot.eff.org/instructions?os=snap&tab=standard&ws=nginx).
