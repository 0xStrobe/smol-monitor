// GET the urls and check the headers to see if cache is expired
// then send a summary to discord using the webhook

import { config } from "dotenv";
config();

const USER_AGENT = "llama-api-monitor-smol";
const MONITOR_V2_WEBHOOK = process.env.MONITOR_V2_WEBHOOK || "";
const BEARER_TOKEN = process.env.BEARER_TOKEN || "";

type Endpoint = {
  name: string;
  url: string;
  interval: number;
};

const endpoints: Endpoint[] = [
  {
    name: "icons server",
    url: process.env.ICONS_SERVER_STATUS_URL || "",
    interval: 5 * 60 * 1000,
  },
  {
    name: "defillama server",
    url: process.env.DL_SERVER_STATUS_URL || "",
    interval: 5 * 60 * 1000,
  },
  {
    name: "chainlist server",
    url: process.env.CL_SERVER_STATUS_URL || "",
    interval: 5 * 60 * 1000,
  },
];

console.log(`smol monitor has started, tracking ${endpoints.length} urls`);

const sendMessage = async (message: string) => {
  const response = await fetch(MONITOR_V2_WEBHOOK, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content: "```\n" + message + "\n```",
    }),
  });
  return response;
};

type StatusResponseJson = {
  name: string;
  status: {
    isRunning: boolean;
    isExited: boolean;
    isRestarting: boolean;
  };
}[];

const checkUrl = async (url: string) => {
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Authorization: `Bearer ${BEARER_TOKEN}`,
    },
  });
  if (!response.ok) {
    throw new Error(`Error ${response.status} checking url: ${url}`);
  }
  const json: StatusResponseJson = await response.json();
  const status = json[0].status;
  if (status.isExited) {
    return "exited";
  } else if (status.isRestarting) {
    return "restarting";
  } else if (status.isRunning) {
    return "running";
  }
};

const checkEndpoint = async (ep: Endpoint) => {
  try {
    console.log(`checking ${ep.name}`);
    const status = await checkUrl(ep.url);
    if (status !== "running") {
      await sendMessage(`${ep.name} is ${status}`);
    }
    console.log(`${ep.name} is ${status}`);
  } catch (e) {
    console.error(e);
    await sendMessage(e.message.split("\n")[0] || e.message);
  }
};

const main = async () => {
  for (const ep of endpoints) {
    await checkEndpoint(ep);
    setInterval(async () => {
      await checkEndpoint(ep);
    }, ep.interval);
  }
};

main();
