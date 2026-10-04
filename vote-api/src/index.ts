import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 4001);
const app = createApp();

app.listen(port, () => {
  console.log(`vote-api listening on port ${port}`);
});
