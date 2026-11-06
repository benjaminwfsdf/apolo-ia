// This feature branch is preview-only, even if a linked project accidentally
// designates it as its production branch. Main does not contain this change.
if (process.env.VERCEL_ENV === 'production' && process.env.VERCEL_GIT_COMMIT_REF === 'feat/apolo-2-webllm') {
  console.error('Esta rama solo admite Preview. No se construirá para producción.');
  process.exit(1);
}
