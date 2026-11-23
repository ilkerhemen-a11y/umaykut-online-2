export function loadConfig(env = process.env) {
  const port = Number(env.PORT || 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT 1-65535 arasında bir tam sayı olmalı.");
  }
  return Object.freeze({
    port,
    environment: env.NODE_ENV || "development",
    appName: "Umaykut Online 2",
    version: "2.0.0"
  });
}
