import { SIGNATURE } from './config.js';

const stripExistingSignature = (text) => {
  const value = String(text ?? '').trimEnd();
  return value.endsWith(SIGNATURE) ? value.slice(0, -SIGNATURE.length).trimEnd() : value;
};

export const sign = (text) => `${stripExistingSignature(text)}\n\n${SIGNATURE}`;
export const signCaption = (text) => `${stripExistingSignature(text)}\n${SIGNATURE}`;
