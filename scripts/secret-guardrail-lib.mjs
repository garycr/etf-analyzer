export const secretPatterns = Object.freeze([
  /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/u,
  /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/u,
  /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/u,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/u,
  /\bglpat-[A-Za-z0-9_-]{20,}\b/u,
  /\bnpm_[A-Za-z0-9]{30,}\b/u,
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/u,
  /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/u,
  /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^\s:/]+:[^\s/@]+@/iu,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{20,}\b/iu,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/u,
  /(?:AccountKey|SharedAccessKey|ClientSecret)\s*[:=]\s*["']?[A-Za-z0-9+/=_-]{16,}/iu,
]);

export const findSecrets = (text) => secretPatterns.flatMap((pattern, index) => (
  [...text.matchAll(new RegExp(pattern.source, `${pattern.flags}g`))]
    .map((match) => ({ pattern: index + 1, value: match[0] }))
));
