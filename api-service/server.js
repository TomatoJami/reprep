const express = require("express");
const app = express()
const { auth } = require('express-openid-connect');

const PORT = process.env.PORT || 3000;
const TEAM_NAME = process.env.TEAM_NAME || "Unknown team";

const config = {
  authRequired: false,
  auth0Logout: true,
  secret: process.env.AUTH_SECRET || 'saltedstring',
  baseURL: 'https://reprep.onrender.com', // или URL деплоя
  clientID: 'gAD18gnqNeX75EMeFOq8xd7rG773kiSs',
  issuerBaseURL: 'https://dev-nmxk1zhnhtp63n3q.us.auth0.com'
};

app.use(auth(config));

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

app.get("/api/info", (req, res) => {
  res.json({
    team: TEAM_NAME
  });
});

app.get("/auth-status", (req, res) => {
  res.json({
    loggedIn: req.oidc.isAuthenticated()
  });
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
