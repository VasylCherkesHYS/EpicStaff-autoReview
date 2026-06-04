
docker volume create crew_config
docker volume create crew_pgdata
docker volume create sandbox_venvs
docker compose -f ./../docker-compose.yaml up
pause
