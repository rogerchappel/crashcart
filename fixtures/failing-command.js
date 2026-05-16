console.log("fixture stdout: running local failure");
console.error("src/example.ts(1,1): error TS2307: Cannot find module 'missing-package'");
console.error("API_TOKEN=super-secret-token");
process.exit(1);
