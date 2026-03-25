import { GetCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { Story, StorySummary } from '@news/shared';
import { documentClient } from './dynamodb';
import { env } from './env';

export const listFrontPageStories = async (): Promise<StorySummary[]> => {
  const response = await documentClient.send(
    new QueryCommand({
      TableName: env.storiesTableName,
      IndexName: env.frontPageIndexName,
      KeyConditionExpression: '#publicationStatus = :publicationStatus',
      ExpressionAttributeNames: {
        '#publicationStatus': 'publicationStatus',
      },
      ExpressionAttributeValues: {
        ':publicationStatus': 'PUBLISHED',
      },
      Limit: 30,
      ScanIndexForward: false,
    }),
  );

  return (response.Items as StorySummary[] | undefined) ?? [];
};

export const getStoryById = async (storyId: string): Promise<Story | null> => {
  const response = await documentClient.send(
    new GetCommand({
      TableName: env.storiesTableName,
      Key: {
        id: storyId,
      },
    }),
  );

  return (response.Item as Story | undefined) ?? null;
};

export const upsertStory = async (story: Story) => {
  await documentClient.send(
    new UpdateCommand({
      TableName: env.storiesTableName,
      Key: {
        id: story.id,
      },
      UpdateExpression: `
        SET #title = :title,
            #url = :url,
            #siteLabel = :siteLabel,
            #siteUrl = :siteUrl,
            #sourceKey = :sourceKey,
            #sourceTitle = :sourceTitle,
            #sourceCategory = :sourceCategory,
            #submittedBy = :submittedBy,
            #points = :points,
            #publishedAt = :publishedAt,
            #storyText = :storyText,
            #summary = :summary,
            #rankingScore = :rankingScore,
            #publicationStatus = :publicationStatus,
            #commentCount = if_not_exists(#commentCount, :zero)
      `,
      ExpressionAttributeNames: {
        '#commentCount': 'commentCount',
        '#points': 'points',
        '#publicationStatus': 'publicationStatus',
        '#publishedAt': 'publishedAt',
        '#rankingScore': 'rankingScore',
        '#siteLabel': 'siteLabel',
        '#siteUrl': 'siteUrl',
        '#sourceCategory': 'sourceCategory',
        '#sourceKey': 'sourceKey',
        '#sourceTitle': 'sourceTitle',
        '#storyText': 'storyText',
        '#submittedBy': 'submittedBy',
        '#summary': 'summary',
        '#title': 'title',
        '#url': 'url',
      },
      ExpressionAttributeValues: {
        ':title': story.title,
        ':url': story.url,
        ':siteLabel': story.siteLabel,
        ':siteUrl': story.siteUrl,
        ':sourceKey': story.sourceKey,
        ':sourceTitle': story.sourceTitle,
        ':sourceCategory': story.sourceCategory,
        ':submittedBy': story.submittedBy,
        ':points': story.points,
        ':publishedAt': story.publishedAt,
        ':storyText': story.storyText,
        ':summary': story.summary,
        ':rankingScore': story.rankingScore,
        ':publicationStatus': 'PUBLISHED',
        ':zero': 0,
      },
    }),
  );
};
