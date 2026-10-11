import esbuild from "esbuild";

async function run() {
  // Lambda gets only dist/ (see infra/JobWorker.ts), so every dependency is
  // bundled in.
  const options = {
    entryPoints: ["./src/lambda.ts"],
    bundle: true,
    platform: "node",
    format: "cjs",
    outdir: "dist",
    entryNames: "[name]",
    outExtension: { ".js": ".cjs" },
    target: "node24",
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
