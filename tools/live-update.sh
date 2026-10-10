#!/bin/sh
# Подтягивает git игры и пересобирает живые файлы сайта (_live/): версию и журнал. Устройство и причины в tools/live-build.mjs.
# Запускают таймер deadland-live.timer (каждые 5 минут) и deadland-site-update после git pull.
# Настройки сервера лежат в /etc/default/deadland-live: GAME_REPO, GAME_REFS, GAME_KEY, GAME_URL.
set -u

[ -r /etc/default/deadland-live ] && . /etc/default/deadland-live
SITE=${SITE:-$(cd "$(dirname "$0")/.." && pwd)}
GAME_REPO=${GAME_REPO:-/var/lib/deadland-game.git}
GAME_REFS=${GAME_REFS:-lerk,develop,Eksailed}
GAME_KEY=${GAME_KEY:-/root/.ssh/deadland_game_ro}
GAME_URL=${GAME_URL:-git@github.com:LerkOFF/Deadland.git}
export GAME_REPO GAME_REFS

# Два запуска разом (таймер и выкладка) не должны мешать друг другу
exec 9>/run/lock/deadland-live.lock
flock -w 120 9 || { echo "live-update: занято другим запуском" >&2; exit 1; }

# Ключ только на чтение этого репозитория, другие ключи ssh не подставляет
export GIT_SSH_COMMAND="ssh -i $GAME_KEY -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=20"

if [ ! -d "$GAME_REPO" ]; then
  # Первый запуск: зеркало только нужных веток и без больших файлов, истории VERSION и текстов коммитов этого достаточно
  git init -q --bare "$GAME_REPO" || exit 1
  git -C "$GAME_REPO" remote add origin "$GAME_URL"
  git -C "$GAME_REPO" config --unset-all remote.origin.fetch
  for ref in $(echo "$GAME_REFS" | tr ',' ' '); do
    git -C "$GAME_REPO" config --add remote.origin.fetch "+refs/heads/$ref:refs/heads/$ref"
  done
  git -C "$GAME_REPO" config core.repositoryformatversion 1
  git -C "$GAME_REPO" config extensions.partialClone origin
  git -C "$GAME_REPO" config remote.origin.promisor true
  git -C "$GAME_REPO" config remote.origin.partialclonefilter blob:limit=512k
fi

# Если GitHub недоступен, берём то, что уже скачано: сайт продолжает показывать последнее известное
git -C "$GAME_REPO" fetch -q --prune origin || echo "live-update: git игры не обновился, использую прежний" >&2

node "$SITE/tools/live-build.mjs" --game "$GAME_REPO" --refs "$GAME_REFS" --out "$SITE/_live"
