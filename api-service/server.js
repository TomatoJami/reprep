const express = require("express");
const app = express()

const PORT = process.env.PORT || 3000;
const TEAM_NAME = process.env.TEAM_NAME || "Unknown team";

app.get("/", (req, res) => {
    res.send("Hello, boys!");
});

app.get("/api/info", (req, res) => {
  res.json({
    team: TEAM_NAME
  });
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
