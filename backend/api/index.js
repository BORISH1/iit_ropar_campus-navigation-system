import express from "express";
import cors from "cors";
import { initDb } from "../db.js";
import routes from "../routes.js";


const app = express();


// Initialize DB connection pool
await initDb();


app.use(cors({ origin: "*" }));
app.use(express.json());


// Routes
app.use("/api", routes);


// Health check
app.get("/health", (_, res) => {
  res.json({ status: "ok" });
});


// Important: Do not call app.listen() for Vercel.
// Just export the app so Vercel's serverless wrappers can use it.
export default app;
