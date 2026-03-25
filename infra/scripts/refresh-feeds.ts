import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';
import { getStackOutputs } from './stack-outputs';

const main = async () => {
  const outputs = await getStackOutputs();
  const functionName = outputs.RefreshFunctionName;

  if (!functionName) {
    throw new Error('RefreshFunctionName output is missing.');
  }

  const client = new LambdaClient({
    region: process.env.AWS_REGION ?? 'us-east-1',
  });

  const response = await client.send(
    new InvokeCommand({
      FunctionName: functionName,
      InvocationType: 'RequestResponse',
    }),
  );

  const payload = response.Payload ? Buffer.from(response.Payload).toString('utf-8') : '';

  console.log(payload || 'Refresh completed.');
};

void main();
