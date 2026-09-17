# SongShare

Share musics, albums, artists, podcasts across music streaming services.

## Supported providers

| Provider          | Tracks | Albums | Artists | Podcasts | Podcast episodes |
| ----------------- | ------ | ------ | ------- | -------- | ---------------- |
| **Spotify**       | ✅     | ✅     | ✅      | ✅       | ✅               |
| **Deezer**        | ✅     | ✅     | ✅      | ✅       | ✅               |
| **Qobuz**         | 📅     | 📅     | 📅      | 📅       | 📅               |
| **Apple Music**   | 📅     | 📅     | 📅      | 📅       | 📅               |
| **YouTube Music** | 📅     | 📅     | 📅      | 📅       | 📅               |
| **YouTube**       | 📅     | 📅     | 📅      | 📅       | 📅               |
| **Tidal**         | 📅     | 📅     | 📅      | 📅       | 📅               |
| **Google Music**  | 📅     | 📅     | 📅      | 📅       | 📅               |

## Public API

SongShare is built around straightforward public API.
This project can be [self-hosted](#self-hosting), but if you prefer,
it is hosted and available for free at [https://songshare.example.com](https://songshare.example.com).

### `GET /api?url=<share link>`

Resolves the share link and searches for the same entity on every other supported
provider.

```sh
curl 'https://songshare.example.com/api?url=https://open.spotify.com/track/4PTG3Z6ehGkBFwjybzWkR8'
```

```json
{
 "origin": "spotify",
 "matches": {
  "spotify": {
   "type": "track",
   "name": "Never Gonna Give You Up",
   "url": "https://open.spotify.com/track/4PTG3Z6ehGkBFwjybzWkR8",
   "isrc": "GBARL9300135",
   "artists": [{ "type": "artist", "name": "Rick Astley", "url": "..." }],
   "album": {
    "type": "album",
    "name": "The Best of Me",
    "upc": "4050538598209",
    "url": "...",
    "cover": { "url": "..." },
    "artists": [{ "type": "artist", "name": "Rick Astley", "url": "..." }],
    "release_date": "2026-01-28T00:00:00.000Z"
   }
  },
  "deezer": { "type": "track", "name": "Never Gonna Give You Up", "url": "..." }
 }
}
```

`origin` names the provider the link came from, and is always one of the keys of
`matches`. A provider that has no match for the entity is simply absent, so
`matches` may hold a single entry. Every entity carries a `type`, one of
`track`, `album`, `artist`, `podcast` or `podcast_episode`; the remaining fields
depend on it.

### `GET /api?url=<share link>&providers=<comma-separated-names>`

The same thing against one or more specific providers, when the others are of
no interest.

```sh
curl 'https://songshare.example.com/api/?url=https://www.deezer.com/track/3786363472&providers=spotify,deezer'
```

```json
{
 "origin": "deezer",
 "matches": {
  "deezer": { "type": "track", "name": "Never Gonna Give You Up", "url": "..." },
  "spotify": { "type": "track", "name": "Never Gonna Give You Up", "url": "..." }
 }
}
```

The `providers` query param is a comma-separated list of provider names among
the following: `spotify`, `deezer`.

### `GET /api/share?url=<share link>`

Generates the short link behind a `/s/<id>` page. The same input always returns the
same id, so it is safe to call repeatedly.

```sh
curl 'https://songshare.example.com/api/share?url=https://open.spotify.com/track/4PTG3Z6ehGkBFwjybzWkR8'
```

```json
{ "id": "yndP8PZb", "url": "https://songshare.example.com/s/yndP8PZb" }
```

### Errors

Failures come back as `{"message":"…"}` with a status that says whose fault it
is:

| Status | Meaning                                                                  |
| ------ | ------------------------------------------------------------------------ |
| `400`  | The url is malformed, or no supported provider recognises it             |
| `404`  | The link is well-formed but the provider has no such entity              |
| `502`  | A provider is unreachable, rate-limiting us, or has changed its contract |
| `500`  | Anything else; the body is deliberately opaque                           |

## How matching works

Exact first, text second:

- **Tracks** match on **ISRC**, the recording code the label assigns, when available.
- **Albums** match on **UPC**, when available.
- **Artists, podcasts and podcast episodes** match on name.

A text match is accepted only if the title plausibly names the same thing, so a
loose query does not return a confident wrong answer.

Identifiers are per-release, not per-song: when the other service carries only a
different master or edition, the exact lookup misses and the text fallback
takes over.

## Self-hosting

> If you're new to self-hosting, you should probably consider reading a guide such as [Self Hosting 101 - A Beginner's Guide](https://ente.io/blog/self-hosting-101/).

This project uses docker-compose to run its different parts:

### Getting started

- Requires a Spotify application from the [developer dashboard](https://developer.spotify.com/dashboard).
- Deezer needs no credentials.

```sh
cp .env.example .env
```

Then fill in the values:

- `DATABASE_URL` is only used by the `db:*` scripts
- `SPOTIFY_CLIENT_ID` Spotify client ID ([developer dashboard](https://developer.spotify.com/dashboard))
- `SPOTIFY_CLIENT_SECRET` Spotify client secret ([developer dashboard](https://developer.spotify.com/dashboard))
- `ALLOWED_HOSTS` optional, comma-separated. Hostnames the **dev** server accepts
  besides `localhost`; production is unaffected.
- `SONGSHARE_HOST` only for `just run-traefik`: the hostname Traefik routes to,
  e.g. `songshare.example.com`
- `SONGSHARE_HEALTH_HOST` optional, the status page's hostname. Defaults to `health.` in front of `SONGSHARE_HOST`
- `TRAEFIK_CERTRESOLVER` Traefik TLS certificate resolver name. Comment `traefik.http.routers.songshare.tls*` lines in `compose.traefik.yaml` if you don't use TLS
- `TRAEFIK_ENTRYPOINTS` Traefik entrypoint name
- `TRAEFIK_NETWORK_NAME` Traefik network name

#### With Node

```sh
npm install
npm run dev
```

#### With Docker

```sh
just run
# or for development purposes
just dev
# or behind an existing Traefik, using SONGSHARE_HOST
just run-traefik
```

|           | Port |                                       |
| --------- | ---- | ------------------------------------- |
| songshare | 3000 | the app                               |
| gatus     | 8080 | monitoring and the public status page |
| db        | 5432 | Postgres, unused so far               |

Three compose files, layered:

- **`compose.yaml`**: the stack as it runs for production.
- **`compose.dev.yaml`**: the stack for development purposes, which mounts the
  working tree for hot reload and publishes the ports above.
- **`compose.traefik.yaml`**: routes the app and the status page through an
  existing Traefik instead of publishing ports. Expects Traefik already running
  on an external `traefik` network, and `SONGSHARE_HOST` set.

|             |                                |
| ----------- | ------------------------------ |
| `just run`  | the stack                      |
| `just dev`  | the stack, with hot reload     |
| `just down` | stop and remove the containers |

### Monitoring

[Gatus](https://github.com/TwiN/gatus) monitors the app and serves the public status page.
Its checks live in **`gatus.yaml`** in this repository.

Alerting is commented out at the bottom of that file; uncomment a provider and
add an `alerts:` block to any endpoint if you want to enable alerting for your self-hosted instance.
