import express from "express";

const app = express();

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Vercel backend is running"
  });
});

export default app;