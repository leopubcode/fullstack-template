import esbuild from "esbuild";

async function run() {
  const options = {
    entryPoints: ["./src/index.ts"],
    bundle: true,
    format: "cjs",
    platform: "node",
    outfile: "dist/index.cjs",
    target: "node20",
    // Sidequest imports its backend driver by package name at runtime, so it
    // has to stay in node_modules.
    external: ["sidequest", "@sidequest/*"],
  };

  if (process.env.WATCH_MODE) {
    const ctx = await esbuild.context(options);
    await ctx.watch();
  } else {
    await esbuild.build(options);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
// "build": "esbuild ./src/index.ts --bundle --platform=node --packages=external --outfile=dist/index.cjs --target=node20",
