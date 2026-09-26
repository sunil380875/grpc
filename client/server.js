const express = require("express");

const app = express();
app.use(express.json());

// ── Routes ───────────────────────────────────────────────

app.get("/", (req, res) => {
    res.json({ message: "Express server is running" });
});



// ── Start ────────────────────────────────────────────────

const HTTP_PORT = process.env.HTTP_PORT || 3001;

app.listen(HTTP_PORT, () => {
    console.log(`Express Server running on port ${HTTP_PORT}`);
});