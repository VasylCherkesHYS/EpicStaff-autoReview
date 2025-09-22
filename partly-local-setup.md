# EpicStaff – Hybrid Setup Guide (Local + Docker)
---

## 1. Clone the Repository
```powershell
git clone https://github.com/EpicStaff/EpicStaff.git
cd EpicStaff
```

---

## 2. Prerequisites

- **Visual Studio Build Tools**  
  During installation, select: **Desktop development with C++**

- **Docker Desktop**  
  Must be installed and running

---

## 3. Allow PowerShell Script Execution
Run PowerShell **as Administrator**:

```powershell
Get-ExecutionPolicy
```

If not `RemoteSigned`, then run:
```powershell
Set-ExecutionPolicy RemoteSigned
```

---

## 4. Python & Poetry Setup
```powershell
python.exe -m pip install --upgrade pip
pip install poetry
cd src
```

---

## 5. Start Infrastructure (Docker)

Create required Docker volumes:
```powershell
docker volume create sandbox_venvs; docker volume create sandbox_executions; docker volume create crew_pgdata; docker volume create crew_config
```

Start core infrastructure containers:
```powershell
docker compose up -d redis redis-monitor crewdb frontend
```

At this point:
- **Postgres (crewdb)** runs in Docker on port **5432**  
- **Redis + redis-monitor** run in Docker  
- **Frontend (Angular + Nginx)** runs in Docker  

---

# Running Backend Services Locally  
⚠️ **Reminder:** Each service must be started in a **new terminal**.

---

### 🔹 1. Crew
```powershell
cd crew
python -m venv venv
venv\Scripts\activate
poetry install
python main.py
```

---

### 🔹 2. Django App
```powershell
cd src/django_app
python -m venv venv
venv\Scripts\activate
poetry install
.\entrypoint_debug.ps1
```

---

### 🔹 3. Knowledge

Create `.env` in `src/knowledge`:
```env
DB_NAME=crew
DB_HOST_NAME=localhost
DB_PORT=5432
DB_KNOWLEDGE_USER=knowledge_user
DB_KNOWLEDGE_PASSWORD=knowledge_password
```

Run:
```powershell
cd src/knowledge
python -m venv venv
venv\Scripts\activate
poetry install
python main.py
```

---

### 🔹 4. Sandbox
```powershell
cd src/sandbox
python -m venv venv
venv\Scripts\activate
poetry install
mkdir savefiles
```

Fix dependency path in `src/sandbox/dynamic_venv_executor_chain.py` (line 103):
```python
predefined_libraries = {"../../shared/dotdict"}
```

Run:
```powershell
python main.py
```

---

### 🔹 5. Realtime

Create `.env` in `src/realtime`:
```env
DB_HOST_NAME=127.0.0.1
DB_PORT=5432
DB_NAME=crew
DB_REALTIME_USER=postgres
DB_REALTIME_PASSWORD=admin
```

Run:
```powershell
cd src/realtime
python -m venv venv
venv\Scripts\activate
poetry install
python run_server.py
```

---

### 🔹 6. Manager

Create `.env` in `src/manager`:
```env
DB_MANAGER_USER=manager_user
DB_MANAGER_PASSWORD=manager_password
DB_NAME=crew
DB_PORT=5432
DB_HOST_NAME=127.0.0.1
```

Run:
```powershell
cd src/manager
python -m venv venv
venv\Scripts\activate
poetry install
python app.py
```
