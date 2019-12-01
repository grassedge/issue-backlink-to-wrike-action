const axios = require('axios');
const core = require('@actions/core');
const github = require('@actions/github');

const ACCESS_TOKEN = process.env.WRIKE_ACCESS_TOKEN;
const instance = axios.create({
  baseURL: 'https://www.wrike.com/api/v4/',
  headers: { 'Authorization': `bearer ${ACCESS_TOKEN}` },
});

function wrikeUrlsFromBody(body) {
  const matched = body.match(/https:\/\/www.wrike.com\/open.htm\?id=(\d+)/g);
  if (!matched) {
    return [];
  }
  return matched;
}

async function wrikeTaskIdFromUrl(url) {
  const res = await instance.request({
    url: `/tasks?permalink=${encodeURIComponent(url)}`,
  });
  const task = res.data.data[0];
  return task ? task.id : null
}

async function postToWrike(id, pullreqUrl) {
  const res = await instance.request({
    url: `/tasks/${id}`,
  });
  const task = res.data.data[0];
  const description = task.description;

  if (description.indexOf(pullreqUrl) != -1) { // pullreq url has already been linked.
    console.log('pullreq url: ' + pullreqUrl + ' has already been linked.')
    return;
  }

  await instance.request({
    url: `/tasks/${id}`,
    method: 'put',
    data: {
      description: '<span style="background-color: #966AF0;">Pull-Request:</span> ' + pullreqUrl + '<br /><br />' + description
    }
  });
}

(async function(event) {
  const payload = github.context.payload;

  if (!payload.pull_request) {
    core.setFailed("This action is for pull request events. Please set 'on: pull_request' in your workflow");
    return;
  }

  const { body, html_url } = payload.pull_request;

  const urls = wrikeUrlsFromBody(body);

  const ids = await Promise.all(urls.map(url => wrikeTaskIdFromUrl(url)));

  for (const wrikeTaskId of ids) {
    await postToWrike(wrikeTaskId, html_url);
  }
})().catch(e => {
  core.setFailed(e);
});
