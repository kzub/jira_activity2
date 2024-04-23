import React, { useEffect, useState } from 'react';
import ForgeReconciler, { Text, Inline, User, Stack, xcss, Heading, Strong, Lozenge, CodeBlock, SectionMessage, Image } from '@forge/react';
import { invoke } from '@forge/bridge';
import { requestJira } from '@forge/bridge';

import config from '../../config/default.json'

// ----------------------------------------------------------------------------------------------------------
const convertComments = (data) => {
  const activity = data.fields.comment.comments.map(c => {
    const base = {
      type: 'comment',
      authorId: c.author.accountId,
      created: c.created,
      content: [],
    };

    if (!(c?.body?.type == 'doc')) {
      base.content.push({
        subtype: 'alert',
        value: `unsupported comment type: ${c?.body?.type}`,
      });
      return base;
    }

    base.content = c.body.content.map(bc => {
      if (['paragraph', 'codeBlock', 'mediaSingle'].indexOf(bc.type) == -1) {
        return {
          subtype: 'alert',
          value: `unsupported doc type: ${bc.type}`,
        };
      }

      const paragrapLines = [];
      for (const pc of bc.content) {
        if (bc.type == 'codeBlock' && pc.type == 'text') {
          paragrapLines.push({
            subtype: 'codeBlock',
            value: pc.text,
          });
          continue;
        }
        if (pc.type == 'text') {
          paragrapLines.push({
            subtype: 'text',
            value: pc.text,
          });
          continue;
        }
        if (bc.type == 'mediaSingle' && pc.type == 'media' && pc.attrs?.type == 'file') {
          paragrapLines.push({
            subtype: 'text',
            value: `Image file: ${pc.attrs?.alt}`,
          });
          continue;
        }
        paragrapLines.push({
          subtype: 'alert',
          value: `unsupported paragraph type: ${pc.type}, bc.type: ${bc.type}`,
        });
      }
      return paragrapLines;
    }).flat();

    return base;
  })

  if (data.fields.comment.total > data.fields.comment.maxResults) {
    activity.push({
      type: 'systemAlert',
      created: new Date().toJSON(),
      message: `Cannot load all comments data.total(${data.fields.comment.total}) > data.maxResults(${data.fields.comment.maxResults})`,
    });
  }

  return activity.filter(a => config.comments.ingnoredAccounts.indexOf(a.authorId) == -1);
};

// ----------------------------------------------------------------------------------------------------------
const convertChangelog = (data) => {
  const fieldsToTrack = ['assignee', 'status', 'Test Engineer', 'Reviewer', 'description'];
  const activity = data.changelog.histories.map(v => {
    const base = {
      type: 'change',
      authorId: v.author.accountId,
      created: v.created,
      field: null,
      from: null,
      fromValue: null,
      to: null,
      toValue: null,
    };

    const res = [];
    for (const item of v.items) {
      if (fieldsToTrack.indexOf(item.field) >= 0) {
        res.push({
          ...base,
          field: item.field,
          from: item.from,
          fromValue: item.fromString,
          to: item.to,
          toValue: item.toString,
        });
        continue;
      }
    }

    return res;
  });

  if (data.changelog.total > data.changelog.maxResults) {
    activity.push({
      type: 'systemAlert',
      created: new Date().toJSON(),
      message: `Cannot load all changelog data.changelog.total(${data.changelog.total}) > data.changelog.maxResults(${data.changelog.maxResults})`,
    });
  }

  return activity.flat().filter(a => a.field != 'description' || config.comments.ingnoredAccounts.indexOf(a.authorId) == -1);;
};


 // ----------------------------------------------------------------------------------------------------------
const fetchData = async (issueKey) => {
  const issueRes = await requestJira(`/rest/api/3/issue/${issueKey}?expand=changelog`);
  const issueData = await issueRes.json();

  // console.log(issueData);

  const activity = [
    convertComments(issueData),
    convertChangelog(issueData)
  ]
  .flat()
  .filter(a => !!a)
  .sort((a, b) => new Date(b.created) - new Date(a.created))

  // console.log('activity', activity);

  return activity;
}

// ----------------------------------------------------------------------------------------------------------
const App = () => {
  const [data, setData] = useState(null);

  useEffect(() => {
    invoke('getIssueKey')
      .then(fetchData)
      .then(setData);
  }, []);

  return (
    <>
    <Stack space="space.100">
      { !data ? <Text>Loading...</Text> :
        data.map(a =>
          <Inline>
            {
                (a.type == 'systemAlert') &&
                <Inline alignBlock="center" space="space.050">
                  <SectionMessage appearance="error">
                    <Text>{a.message}</Text>
                  </SectionMessage>
                </Inline>
            }
            {
              (a.type != 'systemAlert') &&
              <>
                <User accountId={a.authorId} />
                <Stack>
                  <Heading as="h6">{a.created.replace('T', ' ').slice(0,19)}</Heading>
                  {
                    (a.type == 'comment') &&
                    <Inline alignBlock="center" space="space.050">
                      <Stack>
                      {
                        a.content.map(c =>
                          <Inline alignBlock="center" space="space.050">
                            {
                              c.subtype == 'text' &&
                                <Text>{c.value}</Text>
                            }
                            {
                              c.subtype == 'codeBlock' &&
                                <CodeBlock language="text" text={c.value} />
                            }
                            {
                              c.subtype == 'alert' &&
                                <SectionMessage appearance="warning">
                                  <Text>{c.value}</Text>
                                </SectionMessage>
                            }
                          </Inline>
                        )
                      }
                      </Stack>
                    </Inline>
                  }
                  {
                    (a.type == 'change' && a.field == 'status') &&
                      <Inline alignBlock="center" space="space.050">
                          <Text>Change <Strong>{a.field}</Strong>:</Text>
                          <Lozenge isBold="true">{a.fromValue}</Lozenge>
                          →
                          <Lozenge isBold="true">{a.toValue}</Lozenge>
                      </Inline>
                  }
                  {
                    (a.type == 'change' && ['Test Engineer', 'Reviewer', 'assignee'].indexOf(a.field) != -1) &&
                      <Inline alignBlock="center" space="space.050">
                          <Text>Change <Strong>{a.field}</Strong>:</Text>
                          <User accountId={a.from} />
                          →
                          <User accountId={a.to} />
                      </Inline>
                  }
                  {
                    (a.type == 'change' && ['description'].indexOf(a.field) != -1) &&
                      <Inline alignBlock="center" space="space.050">
                          <Text>Change <Strong>{a.field}</Strong>:</Text>
                          <Text>{a.toValue}</Text>
                      </Inline>
                  }
                </Stack>
              </>
            }
          </Inline>
        )
      }
    </Stack>
    </>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
