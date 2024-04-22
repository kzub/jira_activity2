import React, { useEffect, useState } from 'react';
import ForgeReconciler, { Text, Inline, User, Stack, xcss, Heading, Badge , Strong} from '@forge/react';
import { invoke } from '@forge/bridge';
import { requestJira } from '@forge/bridge';

const JenkinsAccId = '557058:a348e55f-b824-41eb-90e4-5576b1a85e20';

// ----------------------------------------------------------------------------------------------------------
const convertComments = (data) => {
  const activity = data.comments.map(c => {
    const base = {
      type: 'comment',
      authorId: c.author.accountId,
      created: c.created,
      text: [],
    };

    if (!(c?.body?.type == 'doc')) {
      base.text.push(`unsupported comment type: ${c?.body?.type}`);
      return base;
    }

    base.text = c.body.content.map(bc => {
      if (bc.type != 'paragraph') {
        return `unsupported doc type: ${bc.type}`;
      }

      const paragrapLines = [];
      for (const pc of bc.content) {
        if (pc.type == 'text') {
          paragrapLines.push(pc.text);
          continue;
        }
        paragrapLines.push(`unsupported paragraph type: ${pc.type}`);
      }
      return paragrapLines;
    }).flat();

    return base;
  })

  if (data.total > data.maxResults) {
    activity.push({
      authorId: 'SYSTEM',
      created: new Date().toJSON(),
      text: [`Cannot load all comments data.total(${data.total}) > data.maxResults(${data.maxResults})`],
    });
  }

  return activity.filter(a => a.authorId != JenkinsAccId);
};

// ----------------------------------------------------------------------------------------------------------
const convertChangelog = (data) => {
  const fieldsToTrack = ['assignee', 'status', 'Test Engineer', 'Reviewer'];
  const activity = data.values.map(v => {
    const base = {
      type: 'change',
      authorId: v.author.accountId,
      created: v.created,
      field: '',
      fromValue: '',
      toValue: '',
    };

    const res = [];
    for (const item of v.items) {
      if (fieldsToTrack.indexOf(item.field) >= 0) {
        res.push({
          ...base,
          field: item.field,
          fromValue: item.fromString || '',
          toValue: item.toString || '',
        });
        continue;
      }
    }

    return res;
  });

  if (data.total > data.maxResults) {
    activity.push({
      authorId: 'SYSTEM',
      created: new Date().toJSON(),
      text: [`Cannot load all changelog data.total(${data.total}) > data.maxResults(${data.maxResults})`],
    });
  }

  return activity.flat();
};

 // ----------------------------------------------------------------------------------------------------------
const fetchData = async (issueKey) => {
  const [resComments, resChangelog] = (await Promise.all([
    requestJira(`/rest/api/3/issue/${issueKey}/comment`),
    requestJira(`/rest/api/3/issue/${issueKey}/changelog`),
  ]));
  // history description не от Jenkins

  const dataComments = await resComments.json();
  const dataChangelog = await resChangelog.json();

  console.log(dataComments);
  console.log(dataChangelog);

  const activity = [
    convertComments(dataComments),
    convertChangelog(dataChangelog)
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
            <User accountId={a.authorId} />
            <Stack>
              <Heading as="h6">{a.created.replace('T', ' ').slice(0,19)}</Heading>
              {
                (a.type == 'comment') &&
                <Inline alignBlock="center" space="space.050">
                  <Stack>
                  {
                    a.text.map(txt => <Text>{txt}</Text>)
                  }
                  </Stack>
                </Inline>
              }
              {
                (a.type == 'change') &&
                  <Inline alignBlock="center" space="space.050">
                      <Text>Change field <Strong>{a.field}</Strong>:</Text>
                      <Badge>{a.fromValue}</Badge>
                      →
                      <Badge>{a.toValue}</Badge>
                  </Inline>
              }
            </Stack>

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
