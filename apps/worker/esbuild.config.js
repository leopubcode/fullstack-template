import esbuild from "esbuild";

async function run() {
  // Two entries: the process (index) and the jobs file Sidequest imports by
  // path to run each job (sidequest.jobs). Packages stay in node_modules, as
  // in the API, so both share one copy of @repo/core.
  const options = {
    entryPoints: ["./src/index.ts", "./src/sidequest.jobs.ts"],
    bundle: true,
    platform: "node",
    format: "cjs",
    packages: "external",
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
