import type { GitInspectOptions, GitInspectResult } from "../../types/diagnostics";

export async function inspectGitDiff(
  options: GitInspectOptions,
  repoPath = process.cwd()
): Promise<GitInspectResult> {
  const args = ["git", "-C", repoPath, "diff", `${options.baseRef}..${options.targetRef}`];
  if (options.path) {
    args.push("--", options.path);
  }

  const proc = Bun.spawn(args, {
    stdout: "pipe",
    stderr: "pipe",
  });

  const diff = await new Response(proc.stdout).text();
  await proc.exited;

  const namesProc = Bun.spawn(
    ["git", "-C", repoPath, "diff", "--name-only", `${options.baseRef}..${options.targetRef}`],
    { stdout: "pipe", stderr: "pipe" }
  );
  const namesText = await new Response(namesProc.stdout).text();
  await namesProc.exited;

  const modifiedFiles = namesText
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    diff,
    modifiedFiles,
  };
}
