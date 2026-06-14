import express from "express";
import cors from "cors";
import { initDb } from "../db.js";
import routes from "../routes.js";

const app = express();

await initDb();

app.use(cors({ origin: "*" }));
app.use(express.json());

app.use("/api", routes);

app.get("/health", (_, res) => {
  res.json({ status: "ok" });
});

export default app;