const toolName = process.argv[2];

if (!toolName) {
  throw new Error("Provide the name of the not-yet-implemented tool");
}

console.log(`${toolName}: not yet`);
