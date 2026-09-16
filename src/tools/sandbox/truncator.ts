export const MAX_OUTPUT_CHARS = 4000;

export function truncateOutput(output: string, limit = MAX_OUTPUT_CHARS): string {
  if (output.length <= limit) {
    return output;
  }
  const truncationNotice = `\n... [output truncated: exceeded ${limit} characters]`;
  return output.slice(0, limit - truncationNotice.length) + truncationNotice;
}
