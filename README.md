# news.bolte.cc

`news.bolte.cc` is a serverless Hacker News clone that keeps the original visual language while replacing user submissions with an RSS-driven mix of Hacker News-adjacent sources such as HNRSS, LessWrong, Astral Codex Ten, and major engineering blogs.

## Stack

- Frontend: React 19 + Vite, rendered as a static app and served from S3 through CloudFront.
- Backend: API Gateway + Lambda functions for feed, story, auth bootstrap, and comments.
- Data: DynamoDB tables for stories, comments, and user profiles.
- Auth: Amazon Cognito email/password auth with self-signup.
- Feed refresh: EventBridge invokes a scheduled Lambda every 30 minutes.
- Infra: AWS CDK in TypeScript.
- CI/CD: GitHub Actions, with production deploys using GitHub OIDC into AWS.

## Architecture

- `/` renders a pixel-faithful HN front page shell populated from DynamoDB.
- `/item/:storyId` renders the HN item page shell, including nested comments and inline replies.
- RSS refresh writes deterministic random points and pseudonymous submitters so the front page feels like HN without pretending to be real HN activity.
- The frontend loads `runtime-config.json` at runtime, so the same build artifact can be deployed locally or in AWS without rebuild-time secrets.

## Local commands

Use Node 24. The repo includes `.nvmrc` and declares `engines.node = 24.x`.

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## AWS bootstrap and first deploy

The project assumes the `professional` AWS profile and deploys into `us-east-1` because the CloudFront certificate for `news.bolte.cc` must live there.

```bash
AWS_PROFILE=professional AWS_REGION=us-east-1 pnpm bootstrap
AWS_PROFILE=professional AWS_REGION=us-east-1 pnpm deploy:prod
AWS_PROFILE=professional AWS_REGION=us-east-1 pnpm refresh
AWS_PROFILE=professional AWS_REGION=us-east-1 pnpm smoke
AWS_PROFILE=professional AWS_REGION=us-east-1 pnpm configure-github
```

`pnpm configure-github` writes the stack outputs back to GitHub repo variables:

- `AWS_ROLE_TO_ASSUME`
- `AWS_REGION`
- `SITE_URL`

Those variables are consumed by `.github/workflows/deploy.yml`.

## Production pipeline

- Pull requests and non-`master` pushes run lint, typecheck, tests, and a full synth/build.
- Pushes to `master` assume the AWS deploy role via OIDC, deploy the CDK stack, refresh RSS content, and smoke-test the live site.
