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

This project can be [self-hosted](#self-hosting), but if you prefer, it is hosted and available for free at [link](link).

```sh
curl 'https://link/api?url=https://open.spotify.com/track/4PTG3Z6ehGkBFwjybzWkR8'
```

```json
{
 "origin": "spotify",
 "matches": {
  "spotify": { "type": "track", "name": "Never Gonna Give You Up", "url": "…" },
  "deezer": { "type": "track", "name": "Never Gonna Give You Up", "url": "…" }
 }
}
```

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
```

|           | Port |                                       |
| --------- | ---- | ------------------------------------- |
| songshare | 3000 | the app                               |
| gatus     | 8080 | monitoring and the public status page |
| db        | 5432 | Postgres, unused so far               |

Two compose files, layered:

- **`compose.yaml`**: the stack as it runs for production.
- **`compose.dev.yaml`**: the stack for development purposes, which mounts the
  working tree for hot reload and publishes the ports above. In production they
  are reached through a reverse proxy instead.

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
