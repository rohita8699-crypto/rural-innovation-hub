const fs = require("fs");
const path = require("path");

const requiredFiles = [
  "server.js",
  "public/index.html",
  "public/app.js",
  "public/styles.css",
  "data/db.json",
  "Dockerfile",
  "docker-compose.yml",
  "Jenkinsfile"
];

for (const file of requiredFiles) {
  const fullPath = path.join(__dirname, "..", file);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Missing required file: ${file}`);
  }
}

const db = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "db.json"), "utf8"));

if (!Array.isArray(db.users) || !Array.isArray(db.innovations)) {
  throw new Error("Database seed must contain users and innovations arrays.");
}

if (!db.users.some((user) => user.role === "admin")) {
  throw new Error("Database seed must include one admin user.");
}

console.log("Project checks passed.");
