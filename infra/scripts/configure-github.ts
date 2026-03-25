import { spawnSync } from 'node:child_process';
import { getStackOutputs } from './stack-outputs';

const runGh = (args: string[]) => {
  const result = spawnSync('gh', args, {
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    throw new Error(`gh ${args.join(' ')} failed with status ${result.status}.`);
  }
};

const main = async () => {
  const outputs = await getStackOutputs();
  const roleArn = outputs.GitHubDeployRoleArn;

  if (!roleArn) {
    throw new Error('GitHubDeployRoleArn output is missing.');
  }

  runGh(['variable', 'set', 'AWS_ROLE_TO_ASSUME', '--body', roleArn]);
  runGh(['variable', 'set', 'AWS_REGION', '--body', process.env.AWS_REGION ?? 'us-east-1']);
  runGh(['variable', 'set', 'SITE_URL', '--body', outputs.SiteUrl]);
};

void main();
