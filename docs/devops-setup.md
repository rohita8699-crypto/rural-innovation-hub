# DevOps Setup: Git, Docker, and Jenkins

## Git Integration

Initialize the project and push it to GitHub or GitLab:

```bash
git init
git add .
git commit -m "Initial Rural Innovation Hub implementation"
git branch -M main
git remote add origin <your-repository-url>
git push -u origin main
```

Suggested workflow:

```bash
git checkout -b feature/innovation-submission
git add .
git commit -m "Add innovation submission workflow"
git push origin feature/innovation-submission
```

Create a pull request, review the changes, then merge into `main`. Jenkins should be configured to build from the same repository.

## Docker Integration

Build the image:

```bash
docker build -t rural-innovation-hub:latest .
```

Run the container:

```bash
docker run -d --name rural-innovation-hub -p 3000:3000 rural-innovation-hub:latest
```

Open:

```text
http://localhost:3000
```

Health check endpoint:

```text
http://localhost:3000/api/health
```

Using Docker Compose:

```bash
docker compose up --build
```

## Jenkins Integration

1. Install Jenkins with Node.js, Git, and Docker available on the Jenkins agent.
2. Create a new Pipeline job.
3. Set Pipeline source to `Pipeline script from SCM`.
4. Select Git and paste your repository URL.
5. Use branch `main`.
6. Set script path to `Jenkinsfile`.
7. Save and click `Build Now`.

The included `Jenkinsfile` performs:

- Checkout from Git
- `npm install`
- JavaScript syntax check
- Project structure and seed-data checks
- Docker image build
- Container smoke test using `/api/health`

## Deployment Command

After a successful Jenkins build, deploy on the target server with:

```bash
docker compose up -d --build
```
