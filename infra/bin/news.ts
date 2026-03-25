#!/usr/bin/env node
import 'source-map-support/register.js';
import { App } from 'aws-cdk-lib';
import { NewsStack } from '../lib/news-stack';

const app = new App();

new NewsStack(app, 'NewsStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT ?? '752725527807',
    region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
  },
});
