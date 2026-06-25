# Rural Innovation Hub

A VS Code-ready web implementation based on the Team 10 presentation. It covers the three PPT modules:

- User registration, login, profile, and role-based access
- Innovation submission, validation, editing, archiving, and admin approval
- Discovery with search, filters, detail pages, ratings, comments, and engagement counts

## Run in VS Code

```bash
npm install
npm start
```

Open `http://localhost:3000`.

## Demo Accounts

- Admin: `admin@ruralhub.test`
- Password: `admin123`

You can register new users as `Innovator` or `Viewer`. Innovator submissions go to the admin approval queue before becoming public.

## Tech Stack

- Frontend: HTML, CSS, and React from CDN
- Backend: Node.js and Express
- Storage: JSON file database for a simple classroom/demo setup
- Auth: Demo JWT-style signed token with role-based permissions
- DevOps: Git repository workflow, Docker containerization, and Jenkins pipeline

For production, replace JSON storage with MySQL or MongoDB, add email verification, use stronger password hashing, and move file uploads to object storage.

## DevOps Integration

This project includes:

- `.gitignore` for clean Git commits
- `Dockerfile` to build the Node/Express app as a container
- `docker-compose.yml` to run the app with one command
- `Jenkinsfile` for CI/CD stages: checkout, install, test, Docker build, and smoke test
- `/api/health` endpoint for Docker and Jenkins verification

Detailed setup steps are in [docs/devops-setup.md](docs/devops-setup.md).

## Docker Commands

```bash
docker build -t rural-innovation-hub:latest .
docker run -d --name rural-innovation-hub -p 3000:3000 rural-innovation-hub:latest
```

Or:

```bash
docker compose up --build
```
