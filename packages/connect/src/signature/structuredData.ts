import { bytesToHex } from '@stacks/common';
import { serializeCV } from '@stacks/transactions';
import { createUnsecuredToken, TokenSigner } from 'jsontokens';
import { getDefaultSignatureRequestOptions } from '.';
import { getKeys, hasAppPrivateKey } from '../transactions';
import {
  StructuredDataSignatureOptions,
  StructuredDataSignaturePayload,
  StructuredDataSignaturePopup,
  StructuredDataSignatureRequestOptions,
} from '../types/structuredDataSignature';
import { getStacksProvider } from '../utils';

async function generateTokenAndOpenPopup<T extends StructuredDataSignatureOptions>(
  options: T,
  makeTokenFn: (options: T) => Promise<string>
) {
  const token = await makeTokenFn({
    ...getDefaultSignatureRequestOptions(options),
    ...options,
  } as T);
  return openStructuredDataSignaturePopup({ token, options });
}

function parseUnserializableBigIntValues(payload: any) {
  return {
    ...payload,
    message: bytesToHex(serializeCV(payload.message)),
    domain: bytesToHex(serializeCV(payload.domain)),
  };
}

async function signPayload(payload: StructuredDataSignaturePayload, privateKey: string) {
  const tokenSigner = new TokenSigner('ES256k', privateKey);
  return tokenSigner.signAsync(parseUnserializableBigIntValues(payload));
}

export async function signStructuredMessage(options: StructuredDataSignatureRequestOptions) {
  const { userSession, ..._options } = options;
  if (hasAppPrivateKey(userSession)) {
    const { privateKey, publicKey } = getKeys(userSession);
    const payload: StructuredDataSignaturePayload = {
      ..._options,
      publicKey,
    };
    return signPayload(payload, privateKey);
  }
  // Type casting `any` as payload contains non-serialisable content,
  // such as `StacksNetwork`
  return createUnsecuredToken(parseUnserializableBigIntValues(options));
}

async function openStructuredDataSignaturePopup({ token, options }: StructuredDataSignaturePopup) {
  const provider = getStacksProvider();
  if (!provider) {
    throw new Error('Hiro Wallet not installed.');
  }

  try {
    const signatureResponse = await provider.structuredDataSignatureRequest(token);

    options.onFinish?.(signatureResponse);
  } catch (error) {
    console.error('[Connect] Error during signature request', error);
    options.onCancel?.();
  }
}

export function openStructuredDataSignatureRequestPopup(
  options: StructuredDataSignatureRequestOptions
) {
  return generateTokenAndOpenPopup(options, signStructuredMessage);
}
