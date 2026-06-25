const root = document.getElementById("root");

const state = {
  view: "discover",
  user: JSON.parse(localStorage.getItem("user") || "null"),
  token: localStorage.getItem("token"),
  meta: { sectors: [], regions: [], totals: {} },
  innovations: [],
  selected: null
};

const api = {
  async request(path, options = {}) {
    const response = await fetch(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
        ...(options.headers || {})
      }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Request failed");
    return data;
  }
};

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setView(view) {
  state.view = view;
  render();
}

function setSession(payload) {
  state.token = payload.token;
  state.user = payload.user;
  localStorage.setItem("token", payload.token);
  localStorage.setItem("user", JSON.stringify(payload.user));
}

function logout() {
  state.token = null;
  state.user = null;
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  setView("discover");
}

async function loadMeta() {
  state.meta = await api.request("/api/meta");
}

async function loadInnovations(params = {}) {
  const query = new URLSearchParams(params);
  state.innovations = await api.request(`/api/innovations?${query}`);
}

function layout(content) {
  const adminButton = state.user?.role === "admin"
    ? `<button class="${state.view === "admin" ? "active" : ""}" data-view="admin">Admin</button>`
    : "";

  root.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <div class="topbar-inner">
          <div class="brand">
            <span class="brand-mark">RI</span>
            <span>Rural Innovation Hub</span>
          </div>
          <nav class="nav">
            <button class="${state.view === "discover" ? "active" : ""}" data-view="discover">Discover</button>
            <button class="${state.view === "submit" ? "active" : ""}" data-view="submit">Submit</button>
            <button class="${state.view === "dashboard" ? "active" : ""}" data-view="dashboard">Dashboard</button>
            ${adminButton}
            ${state.user ? `<button class="ghost" id="logoutBtn">Logout</button>` : `<button data-view="auth">Login</button>`}
          </nav>
        </div>
      </header>
      <main class="page">${content}</main>
    </div>
  `;

  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.view === "dashboard" && !state.user) return setView("auth");
      setView(button.dataset.view);
    });
  });

  document.getElementById("logoutBtn")?.addEventListener("click", logout);
}

function hero() {
  const totals = state.meta.totals || {};
  return `
    <section class="hero">
      <div>
        <h1>Showcase grassroots inventions beyond the village boundary.</h1>
        <p>A secure digital repository where rural innovators can submit local solutions, and students, researchers, and communities can discover, discuss, and replicate them.</p>
        <div class="hero-actions">
          <button id="goSubmit">Submit Innovation</button>
          <button class="ghost" id="goCatalog">Explore Catalog</button>
        </div>
      </div>
      <aside class="stat-panel">
        <div class="stat"><span>Approved innovations</span><strong>${totals.innovations || 0}</strong></div>
        <div class="stat"><span>Total views</span><strong>${totals.views || 0}</strong></div>
        <div class="stat"><span>Community comments</span><strong>${totals.comments || 0}</strong></div>
      </aside>
    </section>
  `;
}

function innovationCards() {
  if (!state.innovations.length) return `<p class="muted">No innovations match these filters yet.</p>`;

  return `
    <div class="grid">
      ${state.innovations.map((item) => `
        <article class="card">
          <img class="card-image" src="${escapeHtml(item.imageUrl || "https://images.unsplash.com/photo-1492496913980-501348b61469?auto=format&fit=crop&w=900&q=80")}" alt="" />
          <div class="card-body">
            <span class="status">${escapeHtml(item.sector)}</span>
            <h3>${escapeHtml(item.title)}</h3>
            <p class="muted">${escapeHtml(item.description)}</p>
            <div class="pill-row">
              <span class="pill">${escapeHtml(item.region)}</span>
              <span class="pill">Rs. ${escapeHtml(item.cost || 0)}</span>
              <span class="pill">Rating ${escapeHtml(item.averageRating || "New")}</span>
            </div>
          </div>
          <div class="card-footer">
            <span class="muted">${escapeHtml(item.views)} views</span>
            <button class="ghost open-detail" data-id="${escapeHtml(item.id)}">View</button>
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

async function renderDiscover() {
  await loadMeta();
  await loadInnovations();
  layout(`
    ${hero()}
    <section id="catalog">
      <form class="toolbar" id="searchForm">
        <label>Keyword<input name="q" placeholder="Search title, tag, sector" /></label>
        <label>Sector<select name="sector">
          <option value="">All sectors</option>
          ${state.meta.sectors.map((sector) => `<option>${escapeHtml(sector)}</option>`).join("")}
        </select></label>
        <label>Region<input name="region" placeholder="State or area" /></label>
        <label>Sort<select name="sort">
          <option value="date">Newest</option>
          <option value="rating">Top rated</option>
          <option value="views">Most viewed</option>
          <option value="cost">Lowest cost</option>
        </select></label>
        <button>Search</button>
      </form>
      <div id="cards">${innovationCards()}</div>
    </section>
  `);

  document.getElementById("goSubmit").addEventListener("click", () => setView("submit"));
  document.getElementById("goCatalog").addEventListener("click", () => document.getElementById("catalog").scrollIntoView());
  document.getElementById("searchForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.target).entries());
    await loadInnovations(form);
    document.getElementById("cards").innerHTML = innovationCards();
    bindDetailButtons();
  });
  bindDetailButtons();
}

function bindDetailButtons() {
  document.querySelectorAll(".open-detail").forEach((button) => {
    button.addEventListener("click", () => {
      state.selected = button.dataset.id;
      setView("detail");
    });
  });
}

function renderAuth() {
  layout(`
    <section class="panel auth-box">
      <h2 id="authTitle">Login</h2>
      <form class="form-grid" id="authForm">
        <label class="register-only" style="display:none">Name<input name="name" /></label>
        <label>Email<input required type="email" name="email" /></label>
        <label>Password<input required type="password" name="password" /></label>
        <label class="register-only" style="display:none">Role<select name="role">
          <option value="innovator">Innovator</option>
          <option value="viewer">Viewer</option>
        </select></label>
        <label class="register-only" style="display:none">Region<input name="region" /></label>
        <label class="wide register-only" style="display:none">Bio<textarea name="bio"></textarea></label>
        <div class="wide actions">
          <button id="authSubmit">Login</button>
          <button type="button" class="ghost" id="toggleAuth">Need an account?</button>
        </div>
      </form>
      <p class="message error" id="authMessage"></p>
      <p class="muted">Admin demo: admin@ruralhub.test / admin123</p>
    </section>
  `);

  let mode = "login";
  const toggle = () => {
    mode = mode === "login" ? "register" : "login";
    document.getElementById("authTitle").textContent = mode === "login" ? "Login" : "Create Account";
    document.getElementById("authSubmit").textContent = mode === "login" ? "Login" : "Register";
    document.getElementById("toggleAuth").textContent = mode === "login" ? "Need an account?" : "Already registered?";
    document.querySelectorAll(".register-only").forEach((item) => {
      item.style.display = mode === "login" ? "none" : "";
    });
  };

  document.getElementById("toggleAuth").addEventListener("click", toggle);
  document.getElementById("authForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const payload = await api.request(`/api/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(new FormData(event.target).entries()))
      });
      setSession(payload);
      setView("dashboard");
    } catch (error) {
      document.getElementById("authMessage").textContent = error.message;
    }
  });
}

function gate(title, body) {
  layout(`
    <section class="panel auth-box">
      <h2>${escapeHtml(title)}</h2>
      <p class="muted">${escapeHtml(body)}</p>
      <button data-view="auth">Continue</button>
    </section>
  `);
}

function renderSubmit() {
  if (!state.user) return gate("Login required", "Please login or register as an innovator to submit local inventions.");

  layout(`
    <section class="panel">
      <h2>Innovation Submission</h2>
      <form class="form-grid" id="submitForm">
        <label>Title<input required name="title" /></label>
        <label>Sector<input required name="sector" placeholder="Agriculture, Energy, Health" /></label>
        <label>Region<input required name="region" /></label>
        <label>Estimated Cost<input type="number" name="cost" /></label>
        <label class="wide">Description<textarea required name="description"></textarea></label>
        <label>Tags<input name="tags" placeholder="comma separated" /></label>
        <label>Image URL<input name="imageUrl" /></label>
        <label class="wide">Document URL<input name="documentUrl" /></label>
        <div class="wide"><button>Submit for Review</button></div>
      </form>
      <p class="message" id="submitMessage"></p>
    </section>
  `);

  document.getElementById("submitForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const saved = await api.request("/api/innovations", {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(new FormData(event.target).entries()))
      });
      document.getElementById("submitMessage").textContent =
        saved.status === "pending" ? "Submitted for admin approval." : "Innovation published.";
      setTimeout(() => setView("dashboard"), 800);
    } catch (error) {
      document.getElementById("submitMessage").textContent = error.message;
    }
  });
}

async function renderDetail() {
  const item = await api.request(`/api/innovations/${state.selected}`);
  layout(`
    <section class="detail-grid">
      <div>
        <img class="detail-image" src="${escapeHtml(item.imageUrl || "https://images.unsplash.com/photo-1492496913980-501348b61469?auto=format&fit=crop&w=900&q=80")}" alt="" />
        <h1>${escapeHtml(item.title)}</h1>
        <p>${escapeHtml(item.description)}</p>
        <div class="pill-row">
          <span class="pill">${escapeHtml(item.sector)}</span>
          <span class="pill">${escapeHtml(item.region)}</span>
          <span class="pill">Rs. ${escapeHtml(item.cost)}</span>
          ${item.tags.map((tag) => `<span class="pill">${escapeHtml(tag)}</span>`).join("")}
        </div>
      </div>
      <aside class="panel">
        <h3>Inventor & Engagement</h3>
        <p><strong>${escapeHtml(item.authorName)}</strong></p>
        <p class="muted">${escapeHtml(item.views)} views · Rating ${escapeHtml(item.averageRating || "New")}</p>
        <div class="inline-actions">
          <select id="rating">${[5, 4, 3, 2, 1].map((n) => `<option value="${n}">${n} stars</option>`).join("")}</select>
          <button id="rateBtn">Rate</button>
        </div>
        <h3>Knowledge Sharing</h3>
        <form id="commentForm">
          <textarea required name="message" placeholder="Add feedback, replication ideas, or questions"></textarea>
          <button>Comment</button>
        </form>
        ${item.comments.map((entry) => `
          <div class="comment">
            <strong>${escapeHtml(entry.user)}</strong>
            <p>${escapeHtml(entry.message)}</p>
          </div>
        `).join("")}
      </aside>
    </section>
  `);

  document.getElementById("rateBtn").addEventListener("click", async () => {
    await api.request(`/api/innovations/${state.selected}/rate`, {
      method: "POST",
      body: JSON.stringify({ rating: Number(document.getElementById("rating").value) })
    });
    renderDetail();
  });

  document.getElementById("commentForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    await api.request(`/api/innovations/${state.selected}/comments`, {
      method: "POST",
      body: JSON.stringify(Object.fromEntries(new FormData(event.target).entries()))
    });
    renderDetail();
  });
}

async function renderDashboard() {
  if (!state.user) return gate("Dashboard locked", "Login to manage your profile and innovation submissions.");
  const profile = await api.request("/api/profile");
  layout(`
    <section class="dashboard-grid">
      <div class="panel">
        <h2>Profile Dashboard</h2>
        <p><strong>${escapeHtml(profile.user.name)}</strong></p>
        <p class="muted">${escapeHtml(profile.user.role)} · ${escapeHtml(profile.user.region || "Region not set")}</p>
        <p>${escapeHtml(profile.user.bio || "Add a short profile bio to help collaborators understand your work.")}</p>
      </div>
      <div class="panel">
        <h2>Your Innovations</h2>
        <div class="table-list">
          ${profile.uploads.length ? profile.uploads.map((item) => `
            <div class="list-item">
              <div>
                <strong>${escapeHtml(item.title)}</strong>
                <p class="muted">${escapeHtml(item.status)} · ${escapeHtml(item.views)} views · rating ${escapeHtml(item.averageRating || "New")}</p>
              </div>
              <button class="ghost open-detail" data-id="${escapeHtml(item.id)}">Open</button>
            </div>
          `).join("") : `<p class="muted">No submissions yet.</p>`}
        </div>
      </div>
    </section>
  `);
  bindDetailButtons();
}

async function renderAdmin() {
  if (state.user?.role !== "admin") return gate("Admin only", "This workflow is restricted to reviewers.");
  const items = await api.request("/api/admin/pending");
  layout(`
    <section class="panel">
      <h2>Admin Approval Queue</h2>
      <div class="table-list">
        ${items.length ? items.map((item) => `
          <div class="list-item">
            <div>
              <strong>${escapeHtml(item.title)}</strong>
              <p class="muted">${escapeHtml(item.sector)} · ${escapeHtml(item.region)} · submitted by ${escapeHtml(item.authorName)}</p>
            </div>
            <button class="approve-btn" data-id="${escapeHtml(item.id)}">Approve</button>
          </div>
        `).join("") : `<p class="muted">No pending innovations.</p>`}
      </div>
      <p class="message" id="adminMessage"></p>
    </section>
  `);

  document.querySelectorAll(".approve-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      await api.request(`/api/admin/innovations/${button.dataset.id}/approve`, { method: "POST" });
      document.getElementById("adminMessage").textContent = "Innovation approved and published.";
      setTimeout(renderAdmin, 500);
    });
  });
}

async function render() {
  try {
    if (state.view === "discover") return renderDiscover();
    if (state.view === "auth") return renderAuth();
    if (state.view === "submit") return renderSubmit();
    if (state.view === "detail") return renderDetail();
    if (state.view === "dashboard") return renderDashboard();
    if (state.view === "admin") return renderAdmin();
  } catch (error) {
    layout(`<section class="panel"><h2>Something went wrong</h2><p class="error">${escapeHtml(error.message)}</p></section>`);
  }
}

render();
