import { createApp } from "./app.js";
import { createPool } from "./db.js";

const port = Number(process.env.PORT ?? 4002);
const pool = createPool();
const app = createApp(pool);

app.listen(port, () => {
  console.log(`ranking-api listening on port ${port}`);
});
