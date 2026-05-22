// Empty shim for the `ws` Node.js WebSocket package.
// @neondatabase/serverless optionally imports `ws` for Pool/Client WebSocket
// connections. We use the HTTP-only neon() function, so this module is never
// actually called — we just need Metro to resolve it without bundling Node.js
// internals (net, tls, http) that don't exist in React Native.
module.exports = {};
