process.on("SIGTERM", () => {
  // Deliberately keep running to exercise crashcart's timeout escalation.
});

setInterval(() => {}, 1000);
