import Resolver from '@forge/resolver';
import { requestJira } from '@forge/bridge';

const resolver = new Resolver();

resolver.define('getIssueKey',  (req) => {
  // console.log(JSON.stringify(req));
  //  {"payload":{"example":"my-invoke-variable"},"context":{"accountId":"557058:bb294dcd-bb33-4330-8157-aeb3028d34ae","localId":"ari:cloud:ecosystem::extension/94f1dd21-c9e6-45ba-8a9c-24253f93b47a/1a33f14f-389f-479a-969c-43bed2c8a7ba/static/activity2-hello-world-issue-activity","cloudId":"068d7524-4e2e-40b1-b1ab-61a54cd8863f","moduleKey":"activity2-hello-world-issue-activity","extension":{"issue":{"key":"TEST-1","id":"10000","type":"Story","typeId":"10001"},"project":{"id":"10000","key":"TEST","type":"software"},"type":"jira:issueActivity"},"accountType":"licensed","installContext":"ari:cloud:jira::site/068d7524-4e2e-40b1-b1ab-61a54cd8863f"}}
  const issueKey = req.context.extension.issue.key;
  console.log(`issueKey: ${issueKey}`);

  return issueKey;
});

export const handler = resolver.getDefinitions();
