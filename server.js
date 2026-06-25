const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, "data", "db.json");
const JWT_SECRET = process.env.JWT_SECRET || "rural-innovation-demo-secret";

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "rural-innovation-hub",
    timestamp: new Date().toISOString()
  });
});

function readDb() {
  return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
}

function writeDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function toBase64Url(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function signToken(payload) {
  const header = toBase64Url({ alg: "HS256", typ: "JWT" });
  const body = toBase64Url({ ...payload, exp: Date.now() + 1000 * 60 * 60 * 8 });
  const signature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${signature}`;
}

function verifyToken(token) {
  if (!token) return null;
  const [header, body, signature] = token.split(".");
  const expected = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${header}.${body}`)
    .digest("base64url");

  if (signature !== expected) return null;

  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  return payload.exp > Date.now() ? payload : null;
}

function auth(required = true) {
  return (req, res, next) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    const payload = verifyToken(token);

    if (!payload && required) {
      return res.status(401).json({ error: "Authentication required" });
    }

    req.user = payload;
    next();
  };
}

function publicUser(user) {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

function averageRating(innovation) {
  if (!innovation.ratingCount) return 0;
  return Number((innovation.ratingSum / innovation.ratingCount).toFixed(1));
}

function enrichInnovation(innovation) {
  return {
    ...innovation,
    averageRating: averageRating(innovation)
  };
}

app.post("/api/auth/register", (req, res) => {
  const { name, email, password, role = "viewer", region = "", bio = "" } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, email, and password are required" });
  }

  const db = readDb();
  const exists = db.users.some((user) => user.email.toLowerCase() === email.toLowerCase());
  if (exists) return res.status(409).json({ error: "Email already registered" });

  const user = {
    id: crypto.randomUUID(),
    name,
    email,
    passwordHash: hashPassword(password),
    role,
    region,
    bio,
    createdAt: new Date().toISOString()
  };

  db.users.push(user);
  writeDb(db);

  const token = signToken({ id: user.id, name: user.name, role: user.role });
  res.status(201).json({ token, user: publicUser(user) });
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  const db = readDb();
  const user = db.users.find((item) => item.email.toLowerCase() === email?.toLowerCase());

  if (!user || user.passwordHash !== hashPassword(password || "")) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const token = signToken({ id: user.id, name: user.name, role: user.role });
  res.json({ token, user: publicUser(user) });
});

app.get("/api/profile", auth(), (req, res) => {
  const db = readDb();
  const user = db.users.find((item) => item.id === req.user.id);
  const uploads = db.innovations.filter((item) => item.authorId === req.user.id);
  res.json({ user: publicUser(user), uploads: uploads.map(enrichInnovation) });
});

app.put("/api/profile", auth(), (req, res) => {
  const db = readDb();
  const user = db.users.find((item) => item.id === req.user.id);
  Object.assign(user, {
    name: req.body.name ?? user.name,
    region: req.body.region ?? user.region,
    bio: req.body.bio ?? user.bio
  });
  writeDb(db);
  res.json({ user: publicUser(user) });
});

app.get("/api/innovations", (req, res) => {
  const { q = "", sector = "", region = "", sort = "date", includePending = "false" } = req.query;
  const db = readDb();
  const keyword = q.toLowerCase();
  let rows = db.innovations.filter((item) => item.status === "approved" || includePending === "true");

  if (keyword) {
    rows = rows.filter((item) =>
      [item.title, item.description, item.sector, item.region, item.tags.join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(keyword)
    );
  }
  if (sector) rows = rows.filter((item) => item.sector === sector);
  if (region) rows = rows.filter((item) => item.region.toLowerCase().includes(region.toLowerCase()));

  rows.sort((a, b) => {
    if (sort === "rating") return averageRating(b) - averageRating(a);
    if (sort === "views") return b.views - a.views;
    if (sort === "cost") return a.cost - b.cost;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  res.json(rows.map(enrichInnovation));
});

app.get("/api/innovations/:id", (req, res) => {
  const db = readDb();
  const innovation = db.innovations.find((item) => item.id === req.params.id);
  if (!innovation) return res.status(404).json({ error: "Innovation not found" });

  innovation.views += 1;
  writeDb(db);
  res.json(enrichInnovation(innovation));
});

app.post("/api/innovations", auth(), (req, res) => {
  if (req.user.role === "viewer") {
    return res.status(403).json({ error: "Only innovators and admins can submit innovations" });
  }

  const { title, description, sector, region, cost, tags = "", imageUrl = "", documentUrl = "" } = req.body;
  if (!title || !description || !sector || !region) {
    return res.status(400).json({ error: "Title, description, sector, and region are required" });
  }

  const db = readDb();
  const innovation = {
    id: crypto.randomUUID(),
    title,
    description,
    sector,
    region,
    cost: Number(cost || 0),
    tags: String(tags)
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
    imageUrl,
    documentUrl,
    authorId: req.user.id,
    authorName: req.user.name,
    status: req.user.role === "admin" ? "approved" : "pending",
    views: 0,
    ratingSum: 0,
    ratingCount: 0,
    comments: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.innovations.push(innovation);
  writeDb(db);
  res.status(201).json(enrichInnovation(innovation));
});

app.put("/api/innovations/:id", auth(), (req, res) => {
  const db = readDb();
  const innovation = db.innovations.find((item) => item.id === req.params.id);
  if (!innovation) return res.status(404).json({ error: "Innovation not found" });
  if (innovation.authorId !== req.user.id && req.user.role !== "admin") {
    return res.status(403).json({ error: "You can update only your own submissions" });
  }

  ["title", "description", "sector", "region", "imageUrl", "documentUrl"].forEach((field) => {
    if (req.body[field] !== undefined) innovation[field] = req.body[field];
  });
  if (req.body.cost !== undefined) innovation.cost = Number(req.body.cost);
  if (req.body.tags !== undefined) {
    innovation.tags = String(req.body.tags).split(",").map((tag) => tag.trim()).filter(Boolean);
  }
  innovation.status = req.user.role === "admin" ? req.body.status || innovation.status : "pending";
  innovation.updatedAt = new Date().toISOString();
  writeDb(db);
  res.json(enrichInnovation(innovation));
});

app.delete("/api/innovations/:id", auth(), (req, res) => {
  const db = readDb();
  const innovation = db.innovations.find((item) => item.id === req.params.id);
  if (!innovation) return res.status(404).json({ error: "Innovation not found" });
  if (innovation.authorId !== req.user.id && req.user.role !== "admin") {
    return res.status(403).json({ error: "You can archive only your own submissions" });
  }
  innovation.status = "archived";
  innovation.updatedAt = new Date().toISOString();
  writeDb(db);
  res.json({ ok: true });
});

app.post("/api/innovations/:id/rate", auth(false), (req, res) => {
  const rating = Number(req.body.rating);
  if (rating < 1 || rating > 5) return res.status(400).json({ error: "Rating must be 1 to 5" });

  const db = readDb();
  const innovation = db.innovations.find((item) => item.id === req.params.id);
  if (!innovation) return res.status(404).json({ error: "Innovation not found" });
  innovation.ratingSum += rating;
  innovation.ratingCount += 1;
  writeDb(db);
  res.json(enrichInnovation(innovation));
});

app.post("/api/innovations/:id/comments", auth(false), (req, res) => {
  if (!req.body.message) return res.status(400).json({ error: "Comment message is required" });

  const db = readDb();
  const innovation = db.innovations.find((item) => item.id === req.params.id);
  if (!innovation) return res.status(404).json({ error: "Innovation not found" });
  innovation.comments.push({
    id: crypto.randomUUID(),
    user: req.user?.name || req.body.name || "Guest",
    message: req.body.message,
    createdAt: new Date().toISOString()
  });
  writeDb(db);
  res.status(201).json(enrichInnovation(innovation));
});

app.get("/api/admin/pending", auth(), (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Admin role required" });
  const db = readDb();
  res.json(db.innovations.filter((item) => item.status === "pending").map(enrichInnovation));
});

app.post("/api/admin/innovations/:id/approve", auth(), (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Admin role required" });
  const db = readDb();
  const innovation = db.innovations.find((item) => item.id === req.params.id);
  if (!innovation) return res.status(404).json({ error: "Innovation not found" });
  innovation.status = "approved";
  innovation.updatedAt = new Date().toISOString();
  writeDb(db);
  res.json(enrichInnovation(innovation));
});

app.get("/api/meta", (_req, res) => {
  const db = readDb();
  const approved = db.innovations.filter((item) => item.status === "approved");
  res.json({
    sectors: [...new Set(approved.map((item) => item.sector))].sort(),
    regions: [...new Set(approved.map((item) => item.region))].sort(),
    totals: {
      innovations: approved.length,
      views: approved.reduce((sum, item) => sum + item.views, 0),
      comments: approved.reduce((sum, item) => sum + item.comments.length, 0)
    }
  });
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Rural Innovation Hub running at http://localhost:${PORT}`);
});
