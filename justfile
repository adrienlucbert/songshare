set dotenv-load := true

prod_files := "-f compose.yaml"
dev_files := "-f compose.yaml -f compose.dev.yaml"
traefik_files := "-f compose.yaml -f compose.traefik.yaml"

# List the available recipes
default:
	@just --list

# Build and run the stack: app on 3000, monitoring on 3001
run *FLAGS:
	docker compose {{prod_files}} up --renew-anon-volumes {{FLAGS}}

# Build and run the stack with the working tree mounted and hot reload.
dev *FLAGS:
	docker compose {{dev_files}} up --renew-anon-volumes {{FLAGS}}

# Build and run the stack behind an existing Traefik, using SONGSHARE_HOST
run-traefik *FLAGS:
	docker compose {{traefik_files}} up --renew-anon-volumes {{FLAGS}}

# Stop everything and remove the containers
down *FLAGS:
	docker compose {{dev_files}} down {{FLAGS}}
