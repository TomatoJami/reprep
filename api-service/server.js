const express = require("express");
const app = express();
const { auth } = require("express-openid-connect");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const supabase = require("./supabase");

const PORT = process.env.PORT || 3000;
const TEAM_NAME = process.env.TEAM_NAME || "Unknown team";

const config = {
  authRequired: false,
  auth0Logout: true,
  secret: process.env.AUTH_SECRET || "saltedstring",
  baseURL: "https://reprep.onrender.com",
  clientID: "gAD18gnqNeX75EMeFOq8xd7rG773kiSs",
  issuerBaseURL: "https://dev-nmxk1zhnhtp63n3q.us.auth0.com"
};

app.use(auth(config));
app.use(express.json());

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

app.get("/api/info", (req, res) => {
  res.json({
    team: TEAM_NAME
  });
});

app.get("/payment-link", (req, res) => {
  if (!req.oidc.isAuthenticated()) {
    return res.status(401).json({ error: "Not logged in" });
  }

  const auth0_id = req.oidc.user.sub;

  const url =
    process.env.STRIPE_PAYMENT_LINK +
    "?client_reference_id=" +
    encodeURIComponent(auth0_id);

  res.json({ url });
});

app.get("/auth-status", async (req, res) => {
  if (!req.oidc.isAuthenticated()) {
    return res.json({ loggedIn: false });
  }

  const auth0_id = req.oidc.user.sub;

  const { error } = await supabase
    .from("users")
    .upsert({ auth0_id });

  if (error) {
    console.log("Supabase error:", error);
  }

  res.json({
    loggedIn: true
  });
});

app.get("/pro-status", async (req, res) => {
  if (!req.oidc.isAuthenticated()) {
    return res.json({ pro: false });
  }

  const auth0_id = req.oidc.user.sub;

  const { data } = await supabase
    .from("users")
    .select("pro")
    .eq("auth0_id", auth0_id)
    .single();

  res.json({
    pro: data?.pro || false
  });
});

app.post(
  "/stripe-webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];

    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.log("Webhook signature error:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      const auth0_id = session.client_reference_id;

      if (auth0_id) {
        console.log("Activating PRO for:", auth0_id);

        await supabase
          .from("users")
          .update({ pro: true })
          .eq("auth0_id", auth0_id);
      }
    }

    res.json({ received: true });
  }
);

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});