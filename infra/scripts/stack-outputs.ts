import { CloudFormationClient, DescribeStacksCommand } from '@aws-sdk/client-cloudformation';

const client = new CloudFormationClient({
  region: process.env.AWS_REGION ?? 'us-east-1',
});

export const stackName = process.env.STACK_NAME ?? 'NewsStack';

export const getStackOutputs = async () => {
  const response = await client.send(
    new DescribeStacksCommand({
      StackName: stackName,
    }),
  );

  const stack = response.Stacks?.[0];
  if (!stack?.Outputs) {
    throw new Error(`Unable to load outputs for ${stackName}.`);
  }

  const outputs = Object.fromEntries(
    stack.Outputs.flatMap((output) =>
      output.OutputKey && output.OutputValue ? [[output.OutputKey, output.OutputValue]] : [],
    ),
  );

  return outputs as Record<string, string>;
};
