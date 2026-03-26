import { createECDH } from 'node:crypto';
import {
  CreateSecretCommand,
  GetSecretValueCommand,
  PutSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';

type CustomResourceEvent = {
  PhysicalResourceId?: string;
  RequestType: 'Create' | 'Delete' | 'Update';
  ResourceProperties: {
    secretName?: string;
  };
};

type CustomResourceResponse = {
  Data?: {
    publicKey: string;
    secretArn: string;
  };
  PhysicalResourceId?: string;
};

type VapidSecret = {
  publicKey: string;
  privateKey: string;
};

const secretsClient = new SecretsManagerClient({});

const generateVapidKeys = (): VapidSecret => {
  const ecdh = createECDH('prime256v1');
  ecdh.generateKeys();

  return {
    privateKey: ecdh.getPrivateKey().toString('base64url'),
    publicKey: ecdh.getPublicKey().toString('base64url'),
  };
};

const parseSecret = (value: string): VapidSecret | null => {
  const parsed = JSON.parse(value) as Partial<VapidSecret>;
  if (!parsed.publicKey || !parsed.privateKey) {
    return null;
  }

  return {
    privateKey: parsed.privateKey,
    publicKey: parsed.publicKey,
  };
};

const loadOrCreateSecret = async (secretName: string) => {
  try {
    const existingSecret = await secretsClient.send(
      new GetSecretValueCommand({
        SecretId: secretName,
      }),
    );

    if (!existingSecret.SecretString) {
      throw new Error(`Secret ${secretName} is empty.`);
    }

    const parsedSecret = parseSecret(existingSecret.SecretString);
    if (!parsedSecret || !existingSecret.ARN) {
      const replacementSecret = generateVapidKeys();
      await secretsClient.send(
        new PutSecretValueCommand({
          SecretId: secretName,
          SecretString: JSON.stringify(replacementSecret),
        }),
      );

      const refreshedSecret = await secretsClient.send(
        new GetSecretValueCommand({
          SecretId: secretName,
        }),
      );

      if (!refreshedSecret.ARN) {
        throw new Error(`Secret ${secretName} is missing an ARN.`);
      }

      return {
        publicKey: replacementSecret.publicKey,
        secretArn: refreshedSecret.ARN,
      };
    }

    return {
      publicKey: parsedSecret.publicKey,
      secretArn: existingSecret.ARN,
    };
  } catch (error) {
    const name =
      typeof error === 'object' && error !== null && 'name' in error ? String(error.name) : '';

    if (name !== 'ResourceNotFoundException') {
      throw error;
    }
  }

  const newSecret = generateVapidKeys();
  const response = await secretsClient.send(
    new CreateSecretCommand({
      Description: 'Web Push VAPID keys for AI News.',
      Name: secretName,
      SecretString: JSON.stringify(newSecret),
    }),
  );

  if (!response.ARN) {
    throw new Error(`Secret ${secretName} is missing an ARN.`);
  }

  return {
    publicKey: newSecret.publicKey,
    secretArn: response.ARN,
  };
};

export const handler = async (event: CustomResourceEvent): Promise<CustomResourceResponse> => {
  const secretName = event.ResourceProperties.secretName;
  if (!secretName) {
    throw new Error('secretName is required.');
  }

  if (event.RequestType === 'Delete') {
    return {
      PhysicalResourceId: event.PhysicalResourceId ?? secretName,
    };
  }

  const { publicKey, secretArn } = await loadOrCreateSecret(secretName);

  return {
    Data: {
      publicKey,
      secretArn,
    },
    PhysicalResourceId: secretName,
  };
};
