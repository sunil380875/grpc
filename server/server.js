const express = require("express");
const { EventEmitter } = require("events");

const app = express();
app.use(express.json());

// ── Shared in-memory store + event bus ───────────────────────────────────────
const userStore = {};          // id → user object
const userEvents = new EventEmitter();
userEvents.setMaxListeners(50); // allow many gRPC subscriber streams

// ── Routes ───────────────────────────────────────────────────────────────────

app.get("/", (req, res) => {
    res.json({ message: "Service A — Express server is running" });
});

/**
 * POST /user
 * Body: { id, name, email }
 * Saves the user and emits a "user:created" event so all gRPC watch
 * streams are notified immediately.
 */
app.post("/user", (req, res) => {
    const { id, name, email } = req.body;

    if (!id || !name || !email) {
        return res.status(400).json({ error: "id, name and email are required" });
    }

    const user = { id: Number(id), name, email };
    userStore[user.id] = user;

    console.log(`[Service A] 📥 HTTP POST /user →`, user);

    // Notify all active gRPC watch streams
    userEvents.emit("user:created", user);

    res.json({ success: true, user });
});

// ── Data helpers (used by gRPC handlers) ─────────────────────────────────────

function getUser(user) {
    return user;
}

function getUserById(id) {
    return userStore[id] || null;
}

module.exports = { getUser, getUserById, userEvents };

// ── Start Express ─────────────────────────────────────────────────────────────

const HTTP_PORT = process.env.HTTP_PORT || 3000;

app.listen(HTTP_PORT, () => {
    console.log(`[Service A] 🌐 Express Server running on http://localhost:${HTTP_PORT}`);
    console.log(`[Service A]    POST http://localhost:${HTTP_PORT}/user  → triggers gRPC stream`);
});